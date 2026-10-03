import { connectDb } from "@/lib/db/mongoose";
import { lastMatchPlayedDateExpression } from "@/lib/last-match-played";
import { MatchModel } from "@/models/match";
import { MatchParticipantModel } from "@/models/match-participant";
import { ScheduledJobRunModel } from "@/models/scheduled-job-run";
import { UserModel } from "@/models/user";
import { getRewardClaimDay } from "@/services/wallet.service";

const DAILY_MATCHES_PLAYED_JOB = "daily-matches-played";

const hasPlayedMatch = {
  $expr: {
    $gt: [
      {
        $convert: {
          input: "$matchesPlayed",
          to: "long",
          onError: 0,
          onNull: 0,
        },
      },
      0,
    ],
  },
};

const incrementMatchesPlayed = [
  {
    $set: {
      matchesPlayed: {
        $let: {
          vars: {
            value: {
              $convert: {
                input: "$matchesPlayed",
                to: "long",
                onError: null,
                onNull: 0,
              },
            },
          },
          in: {
            $cond: [
              { $ne: ["$$value", null] },
              { $toString: { $add: ["$$value", 1] } },
              "$matchesPlayed",
            ],
          },
        },
      },
    },
  },
];

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

/**
 * Gives each player with a recorded match one daily increment when they have
 * have not played during the current UTC calendar day. The synthetic
 * match lowers their win rate without changing their wins.
 *
 * The aggregation remains wholly database-side. Its per-user day marker is
 * checked as each document is merged, so a partial failure or concurrent retry
 * can safely rerun and only apply the missing increments.
 */
export async function incrementDailyMatchesPlayed() {
  const now = new Date();
  const day = getRewardClaimDay(now);
  await connectDb();
  const currentDayStart = new Date(`${day}T00:00:00.000Z`);
  const activityCheckAt = now;

  // lastMatchPlayed is the activity source for new settlements. Fall back to
  // match history for existing users whose activity date predates this field.
  // A player who has not played today is eligible, including a player whose
  // last match was yesterday.
  // Do not use a job-level "already ran today" short circuit: a user can
  // become eligible or be added after an earlier invocation. The per-user
  // dailyMatchesPlayedIncrementDay marker in $merge remains the atomic guard
  // against applying more than one decay increment per UTC day.
  await UserModel.aggregate([
    { $match: hasPlayedMatch },
    {
      $set: {
        normalizedLastMatchPlayed: lastMatchPlayedDateExpression(),
      },
    },
    {
      $lookup: {
        from: MatchParticipantModel.collection.name,
        let: {
          userId: "$_id",
          lastMatchPlayed: "$normalizedLastMatchPlayed",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  {
                    $eq: [
                      { $ifNull: ["$$lastMatchPlayed", null] },
                      null,
                    ],
                  },
                ],
              },
            },
          },
          {
            $lookup: {
              from: MatchModel.collection.name,
              let: { matchId: "$matchId" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$_id", "$$matchId"] },
                    completedAt: {
                      $gte: currentDayStart,
                      $lt: activityCheckAt,
                    },
                  },
                },
              ],
              as: "completedMatch",
            },
          },
          { $match: { "completedMatch.0": { $exists: true } } },
          { $limit: 1 },
        ],
        as: "previousDayActivity",
      },
    },
    {
      $match: {
        $or: [
          { normalizedLastMatchPlayed: { $lt: currentDayStart } },
          {
            $and: [
              { normalizedLastMatchPlayed: null },
              { "previousDayActivity.0": { $exists: false } },
            ],
          },
        ],
      },
    },
    { $project: { dailyMatchesPlayedIncrementDay: { $literal: day } } },
    {
      $merge: {
        into: UserModel.collection.name,
        on: "_id",
        whenMatched: [
          {
            $set: {
              matchesPlayed: {
                $cond: [
                  { $ne: ["$dailyMatchesPlayedIncrementDay", "$$new.dailyMatchesPlayedIncrementDay"] },
                  incrementMatchesPlayed[0].$set.matchesPlayed,
                  "$matchesPlayed",
                ],
              },
              dailyMatchesPlayedIncrementDay: "$$new.dailyMatchesPlayedIncrementDay",
            },
          },
        ],
        whenNotMatched: "discard",
      },
    },
  ]).exec();

  // Keep one completion record per UTC day for operational visibility; it is
  // deliberately not used to skip subsequent invocations.
  try {
    await ScheduledJobRunModel.create([{ jobName: DAILY_MATCHES_PLAYED_JOB, day }]);
    return { day, executed: true, runRecordCreated: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { day, executed: true, runRecordCreated: false };
    }
    throw error;
  }
}

/**
 * Development-test support: clear only today's idempotency state. This does
 * not change match counters; a later job invocation performs the normal +1.
 */
export async function resetTodayDailyMatchStatsJobState() {
  const day = getRewardClaimDay(new Date());
  await connectDb();

  const [users, run] = await Promise.all([
    UserModel.updateMany(
      { dailyMatchesPlayedIncrementDay: day },
      { $unset: { dailyMatchesPlayedIncrementDay: 1 } },
    ),
    ScheduledJobRunModel.deleteOne({ jobName: DAILY_MATCHES_PLAYED_JOB, day }),
  ]);

  return {
    day,
    clearedUserMarkers: users.modifiedCount,
    deletedRunRecord: run.deletedCount === 1,
  };
}

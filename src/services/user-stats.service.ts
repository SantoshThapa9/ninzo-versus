import type { PipelineStage } from "mongoose";
import { connectDb } from "@/lib/db/mongoose";
import { lastMatchPlayedDateExpression } from "@/lib/last-match-played";
import { MatchModel } from "@/models/match";
import { MatchParticipantModel } from "@/models/match-participant";
import { SeasonPlayerStatModel } from "@/models/season-player-stat";
import { ScheduledJobRunModel } from "@/models/scheduled-job-run";
import { UserModel } from "@/models/user";
import { getOrCreateSeasonForDate } from "@/services/season.service";
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

function buildIdlePlayerPipeline(
  dayStart: Date,
  previousDayStart: Date,
  activityCheckAt: Date,
): PipelineStage[] {
  return [
    { $match: hasPlayedMatch },
    {
      $set: {
        normalizedLastMatchPlayed: lastMatchPlayedDateExpression(),
      },
    },
    {
      $lookup: {
        from: MatchParticipantModel.collection.name,
        let: { userId: "$_id", lastMatchPlayed: "$normalizedLastMatchPlayed" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $eq: [{ $ifNull: ["$$lastMatchPlayed", null] }, null] },
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
                    status: "settled",
                    completedAt: { $gte: previousDayStart, $lt: activityCheckAt },
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
          { normalizedLastMatchPlayed: { $lt: previousDayStart } },
          {
            $and: [
              { normalizedLastMatchPlayed: null },
              { "previousDayActivity.0": { $exists: false } },
            ],
          },
        ],
      },
    },
  ];
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

/**
 * Gives each player with a recorded match one daily increment after a full UTC
 * calendar day passes without a settled match. This lowers their win rate
 * without changing their wins.
 *
 * The aggregation remains wholly database-side. Its per-user day marker is
 * checked as each document is merged, so a partial failure or concurrent retry
 * can safely rerun and only apply the missing increments.
 */
export async function incrementDailyMatchesPlayed() {
  const now = new Date();
  const day = getRewardClaimDay(now);
  await connectDb();
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const previousDayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const season = await getOrCreateSeasonForDate(now);

  // A daily increment is earned only after the previous full UTC day passed
  // without a settled match. The per-user and per-season markers make retries
  // idempotent while keeping each month's counters independent.
  await UserModel.aggregate([
    ...buildIdlePlayerPipeline(dayStart, previousDayStart, now),
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

  if (dayStart.getUTCDate() > 1) {
    await UserModel.aggregate([
      ...buildIdlePlayerPipeline(dayStart, previousDayStart, now),
      {
        $project: {
          _id: {
            $concat: [
              { $toString: { $literal: season._id } },
              ":",
              { $toString: "$_id" },
            ],
          },
          userId: "$_id",
          seasonId: { $literal: season._id },
          matchesPlayed: { $literal: 1 },
          settledMatchesPlayed: { $literal: 0 },
          inactivityMatchesPlayed: { $literal: 1 },
          wins: { $literal: 0 },
          dailyMatchesPlayedIncrementDay: { $literal: day },
        },
      },
      {
        $merge: {
          into: SeasonPlayerStatModel.collection.name,
          on: "_id",
          whenMatched: [
            {
              $set: {
                matchesPlayed: {
                  $cond: [
                    {
                      $ne: [
                        "$dailyMatchesPlayedIncrementDay",
                        "$$new.dailyMatchesPlayedIncrementDay",
                      ],
                    },
                    { $add: [{ $ifNull: ["$matchesPlayed", 0] }, 1] },
                    "$matchesPlayed",
                  ],
                },
                inactivityMatchesPlayed: {
                  $cond: [
                    {
                      $ne: [
                        "$dailyMatchesPlayedIncrementDay",
                        "$$new.dailyMatchesPlayedIncrementDay",
                      ],
                    },
                    {
                      $add: [
                        { $ifNull: ["$inactivityMatchesPlayed", 0] },
                        1,
                      ],
                    },
                    "$inactivityMatchesPlayed",
                  ],
                },
                dailyMatchesPlayedIncrementDay:
                  "$$new.dailyMatchesPlayedIncrementDay",
              },
            },
          ],
          whenNotMatched: "insert",
        },
      },
    ]).exec();
  }

  const [incrementedUserCount, incrementedSeasonPlayerCount] =
    await Promise.all([
      UserModel.countDocuments({ dailyMatchesPlayedIncrementDay: day }),
      SeasonPlayerStatModel.countDocuments({
        dailyMatchesPlayedIncrementDay: day,
      }),
    ]);

  // Keep one completion record per UTC day for operational visibility; it is
  // deliberately not used to skip subsequent invocations.
  try {
    await ScheduledJobRunModel.create([{ jobName: DAILY_MATCHES_PLAYED_JOB, day }]);
    return {
      day,
      executed: true,
      runRecordCreated: true,
      incrementedUserCount,
      incrementedSeasonPlayerCount,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return {
        day,
        executed: true,
        runRecordCreated: false,
        incrementedUserCount,
        incrementedSeasonPlayerCount,
      };
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

  const [users, seasonStats, run] = await Promise.all([
    UserModel.updateMany(
      { dailyMatchesPlayedIncrementDay: day },
      { $unset: { dailyMatchesPlayedIncrementDay: 1 } },
    ),
    SeasonPlayerStatModel.updateMany(
      { dailyMatchesPlayedIncrementDay: day },
      { $unset: { dailyMatchesPlayedIncrementDay: 1 } },
    ),
    ScheduledJobRunModel.deleteOne({ jobName: DAILY_MATCHES_PLAYED_JOB, day }),
  ]);

  return {
    day,
    clearedUserMarkers: users.modifiedCount,
    clearedSeasonMarkers: seasonStats.modifiedCount,
    deletedRunRecord: run.deletedCount === 1,
  };
}

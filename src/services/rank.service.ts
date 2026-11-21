import { Types, type ClientSession } from "mongoose";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import {
  getRank,
  getRankScore,
  RANK_PAGE_SIZE,
  type PlayerRank,
} from "@/lib/rank";
import { SeasonModel, type SeasonDoc } from "@/models/season";
import { SeasonPlayerStatModel } from "@/models/season-player-stat";
import { MatchModel } from "@/models/match";
import { ensureMonthlyRankStatFields, UserModel } from "@/models/user";
import { CoinTxnType, MatchStatus, UserRole } from "@/types/enums";
import { getOrCreateSeasonForDate } from "@/services/season.service";
import { applyLedger } from "@/services/wallet.service";
import { getSeasonPlayerStatId } from "@/lib/season-player-stat";
import { MONTHLY_RANK_PRIZE } from "@/config/defaults";

const SNAPSHOT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

type SeasonMatchStat = {
  _id: Types.ObjectId;
  matchesPlayed: number;
  wins: number;
};

function aggregateSeasonMatchStats(
  seasonId: Types.ObjectId,
  session?: ClientSession,
) {
  return MatchModel.aggregate<SeasonMatchStat>([
    {
      $match: {
        seasonId,
        status: MatchStatus.SETTLED,
        winnerTeam: { $in: ["A", "B"] },
      },
    },
    {
      $project: {
        participants: [
          { userId: "$creatorId", won: { $eq: ["$winnerTeam", "A"] } },
          {
            userId: "$opponentCaptainId",
            won: { $eq: ["$winnerTeam", "B"] },
          },
        ],
      },
    },
    { $unwind: "$participants" },
    {
      $group: {
        _id: "$participants.userId",
        matchesPlayed: { $sum: 1 },
        wins: { $sum: { $cond: ["$participants.won", 1, 0] } },
      },
    },
  ])
    .option({ maxTimeMS: 8_000 })
    .session(session ?? null)
    .exec();
}

export type { PlayerRank };
export { RANK_PAGE_SIZE };

export async function getPlayerRank(userId: string) {
  await connectDb();
  const fields = ensureMonthlyRankStatFields(new Date());
  const user = await UserModel.findById(userId)
    .select(`displayName ign ${fields.wins} ${fields.matchesPlayed}`)
    .lean();
  if (!user) return null;

  const wins = Number(user[fields.wins]) || 0;
  const matches = Number(user[fields.matchesPlayed]) || 0;
  const rankScore = getRankScore(wins, matches);
  return {
    userId,
    displayName: user.displayName,
    ign: user.ign?.trim() || user.displayName,
    wins,
    losses: Math.max(matches - wins, 0),
    matches,
    rankScore,
    rank: getRank(rankScore).name,
  } satisfies PlayerRank;
}

type AggregatedPlayer = {
  _id: Types.ObjectId;
  wins: number;
  losses: number;
  matches: number;
  rankScore: number;
  displayName: string;
  ign: string;
};

function toPlayerRank(player: AggregatedPlayer): PlayerRank {
  return {
    userId: String(player._id),
    displayName: player.displayName,
    ign: player.ign?.trim() || player.displayName,
    wins: player.wins,
    losses: player.losses,
    matches: player.matches,
    rankScore: player.rankScore,
    rank: getRank(player.rankScore).name,
  };
}

const rankedPlayerStages = [
  {
    $addFields: {
      losses: { $max: [{ $subtract: ["$matches", "$wins"] }, 0] },
      rankScore: {
        $max: [
          {
            $subtract: [
              { $multiply: ["$wins", 10] },
              {
                $multiply: [
                  { $max: [{ $subtract: ["$matches", "$wins"] }, 0] },
                  5,
                ],
              },
            ],
          },
          0,
        ],
      },
    },
  },
  {
    $sort: {
      rankScore: -1,
      wins: -1,
      matches: -1,
      ign: 1,
      displayName: 1,
      _id: 1,
    },
  },
] as const;

async function aggregateMonthlyRankedPlayers(
  date: Date,
  skip: number,
  limit: number,
) {
  const fields = ensureMonthlyRankStatFields(date);
  return UserModel.aggregate<AggregatedPlayer>([
    { $match: { role: { $ne: UserRole.PLATFORM } } },
    {
      $project: {
        _id: 1,
        wins: {
          $convert: {
            input: `$${fields.wins}`,
            to: "long",
            onError: 0,
            onNull: 0,
          },
        },
        matches: {
          $convert: {
            input: `$${fields.matchesPlayed}`,
            to: "long",
            onError: 0,
            onNull: 0,
          },
        },
        displayName: { $ifNull: ["$displayName", "Player"] },
        ign: {
          $let: {
            vars: {
              trimmedIgn: {
                $trim: { input: { $ifNull: ["$ign", ""] } },
              },
            },
            in: {
              $cond: [
                { $ne: ["$$trimmedIgn", ""] },
                "$$trimmedIgn",
                { $ifNull: ["$displayName", "Player"] },
              ],
            },
          },
        },
      },
    },
    { $match: { matches: { $gte: 1 } } },
    ...rankedPlayerStages,
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        wins: 1,
        matches: 1,
        rankScore: 1,
        losses: 1,
        displayName: 1,
        ign: 1,
      },
    },
  ]).option({ maxTimeMS: 8_000 });
}

async function aggregateSeasonRankedPlayers(
  seasonId: string,
  skip: number,
  limit: number,
) {
  return SeasonPlayerStatModel.aggregate<AggregatedPlayer>([
    {
      $match: {
        seasonId: new Types.ObjectId(seasonId),
        matchesPlayed: { $gte: 1 },
      },
    },
    {
      $lookup: {
        from: UserModel.collection.name,
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: "$userId",
        wins: 1,
        matches: "$matchesPlayed",
        displayName: {
          $ifNull: [
            "$displayName",
            { $ifNull: ["$user.displayName", "Player"] },
          ],
        },
        ign: {
          $let: {
            vars: {
              playerIgn: {
                $ifNull: ["$ign", { $ifNull: ["$user.ign", ""] }],
              },
            },
            in: {
              $cond: [
                { $ne: [{ $trim: { input: "$$playerIgn" } }, ""] },
                { $trim: { input: "$$playerIgn" } },
                {
                  $ifNull: [
                    "$displayName",
                    { $ifNull: ["$user.displayName", "Player"] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    ...rankedPlayerStages,
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        wins: 1,
        matches: 1,
        rankScore: 1,
        losses: 1,
        displayName: 1,
        ign: 1,
      },
    },
  ]).option({ maxTimeMS: 8_000 });
}

export async function listSeasonRanks(
  season: Pick<SeasonDoc, "_id" | "startDate">,
  limit = RANK_PAGE_SIZE,
  offset = 0,
): Promise<{ players: PlayerRank[]; hasMore: boolean }> {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeOffset = Math.max(0, offset);
  await connectDb();
  const rows = await aggregateMonthlyRankedPlayers(
    season.startDate,
    safeOffset,
    safeLimit + 1,
  );
  const hasMore = rows.length > safeLimit;
  const players = (hasMore ? rows.slice(0, safeLimit) : rows).map(toPlayerRank);
  return { players, hasMore };
}

export async function snapshotPreviousSeasonAtMonthStart(date = new Date()) {
  if (date.getUTCDate() !== 1) {
    return {
      executed: false,
      reason: "outside-first-day",
    } as const;
  }

  await connectDb();
  const snapshotDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0),
  );
  const season = await getOrCreateSeasonForDate(snapshotDate);
  const activeSeason = await getOrCreateSeasonForDate(date);
  const activeFields = ensureMonthlyRankStatFields(date);
  if (season.rankingsSnapshottedAt) {
    return { executed: false, reason: "already-snapshotted" } as const;
  }

  const now = new Date();
  const staleLockAt = new Date(now.getTime() - SNAPSHOT_LOCK_TIMEOUT_MS);
  const lock = await SeasonModel.updateOne(
    {
      _id: season._id,
      rankingsSnapshottedAt: { $exists: false },
      $or: [
        { rankingsSnapshotStartedAt: { $exists: false } },
        { rankingsSnapshotStartedAt: { $lte: staleLockAt } },
      ],
    },
    { $set: { rankingsSnapshotStartedAt: now } },
  ).exec();
  if (lock.modifiedCount !== 1) {
    return { executed: false, reason: "snapshot-in-progress" } as const;
  }

  const seasonId = season._id;
  const fields = ensureMonthlyRankStatFields(season.startDate);
  const users = await UserModel.find({
    [fields.matchesPlayed]: { $exists: true },
  })
    .select(`_id displayName ign ${fields.matchesPlayed} ${fields.wins}`)
    .maxTimeMS(8_000)
    .lean();
  await SeasonPlayerStatModel.deleteMany({ seasonId }).exec();
  const rankedUsers = users.filter(
    (user) => Number(user[fields.matchesPlayed]) >= 1,
  );
  if (rankedUsers.length) {
    await SeasonPlayerStatModel.insertMany(
      rankedUsers.map((user) => {
        const displayName = user.displayName ?? "Player";
        return {
          _id: getSeasonPlayerStatId(String(seasonId), String(user._id)),
          userId: user._id,
          seasonId,
          matchesPlayed: Number(user[fields.matchesPlayed]) || 0,
          wins: Number(user[fields.wins]) || 0,
          displayName,
          ign: user.ign?.trim() || displayName,
        };
      }),
      { ordered: false },
    );
  }

  const winners = await aggregateSeasonRankedPlayers(String(seasonId), 0, 10);
  const snapshottedAt = new Date();
  const finalized = await withTransaction(async (session) => {
    const currentSeason = await SeasonModel.findOne({
      _id: seasonId,
      rankingsSnapshottedAt: { $exists: false },
    }).session(session);
    if (!currentSeason) return false;

    for (const player of winners) {
      await applyLedger({
        userId: String(player._id),
        type: CoinTxnType.PRIZE_PAYOUT,
        amount: MONTHLY_RANK_PRIZE,
        availableDelta: MONTHLY_RANK_PRIZE,
        lockedDelta: 0,
        referenceType: "monthly_rank_reward",
        referenceId: season.slug,
        idempotencyKey: `monthly-rank-reward:${season.slug}:${String(player._id)}`,
        metadata: {
          season: season.slug,
          placement: winners.indexOf(player) + 1,
          rankScore: player.rankScore,
        },
        session,
      });
    }

    const result = await SeasonModel.updateOne(
      { _id: seasonId, rankingsSnapshottedAt: { $exists: false } },
      {
        $set: {
          rankingsSnapshottedAt: snapshottedAt,
          status: "completed",
        },
        $unset: { rankingsSnapshotStartedAt: 1 },
      },
      { session },
    ).exec();
    if (result.modifiedCount !== 1) {
      throw new Error(
        `Unable to finalize monthly rankings for ${season.slug}.`,
      );
    }

    await UserModel.updateMany(
      { role: { $ne: UserRole.PLATFORM } },
      {
        $set: {
          matchesPlayed: "0",
          wins: "0",
          [activeFields.matchesPlayed]: "0",
          [activeFields.wins]: "0",
        },
      },
      { session },
    ).exec();
    const activeSeasonStats = await aggregateSeasonMatchStats(
      activeSeason._id,
      session,
    );
    if (activeSeasonStats.length) {
      await UserModel.bulkWrite(
        activeSeasonStats.map((stats) => ({
          updateOne: {
            filter: { _id: stats._id },
            update: {
              $set: {
                matchesPlayed: String(stats.matchesPlayed),
                wins: String(stats.wins),
                [activeFields.matchesPlayed]: String(stats.matchesPlayed),
                [activeFields.wins]: String(stats.wins),
              },
            },
          },
        })),
        { session },
      );
    }
    return true;
  });

  return finalized
    ? {
        executed: true,
        season: season.slug,
        snapshottedAt,
        rewardedPlayers: winners.length,
        rewardPerPlayer: MONTHLY_RANK_PRIZE,
      }
    : { executed: false, reason: "already-snapshotted" };
}

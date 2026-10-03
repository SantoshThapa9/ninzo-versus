import { Types } from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDb } from "@/lib/db/mongoose";
import {
  getRank,
  getWinRate,
  RANK_PAGE_SIZE,
  type PlayerRank,
} from "@/lib/rank";
import { SeasonModel, type SeasonDoc } from "@/models/season";
import { SeasonPlayerStatModel } from "@/models/season-player-stat";
import { UserModel } from "@/models/user";
import { UserRole } from "@/types/enums";
import { getOrCreateSeasonForDate } from "@/services/season.service";

export type { PlayerRank };
export { RANK_PAGE_SIZE };

export async function getPlayerRank(userId: string) {
  await connectDb();
  const user = await UserModel.findById(userId)
    .select("displayName ign wins matchesPlayed")
    .lean();
  if (!user) return null;

  const wins = Number(user.wins) || 0;
  const matches = Number(user.matchesPlayed) || 0;
  const winRate = getWinRate(wins, matches);
  return {
    userId,
    displayName: user.displayName,
    ign: user.ign?.trim() || user.displayName,
    wins,
    matches,
    winRate,
    rank: getRank(winRate).name,
  } satisfies PlayerRank;
}

type AggregatedPlayer = {
  _id: Types.ObjectId;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
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
    winRate: player.winRate,
    rank: getRank(player.winRate).name,
  };
}

const rankedPlayerStages = [
  {
    $addFields: {
      losses: { $max: [{ $subtract: ["$matches", "$wins"] }, 0] },
      winRate: {
        $cond: [
          { $gt: ["$matches", 0] },
          {
            $round: [
              { $multiply: [{ $divide: ["$wins", "$matches"] }, 100] },
              0,
            ],
          },
          0,
        ],
      },
    },
  },
  {
    $sort: {
      winRate: -1,
      wins: -1,
      matches: -1,
      ign: 1,
      displayName: 1,
      _id: 1,
    },
  },
] as const;

async function aggregateCurrentRankedPlayers(skip: number, limit: number) {
  return UserModel.aggregate<AggregatedPlayer>([
    { $match: { role: { $ne: UserRole.PLATFORM } } },
    {
      $project: {
        _id: 1,
        wins: {
          $convert: { input: "$wins", to: "long", onError: 0, onNull: 0 },
        },
        matches: {
          $convert: {
            input: "$matchesPlayed",
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
    { $match: { wins: { $gte: 1 } } },
    ...rankedPlayerStages,
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        wins: 1,
        matches: 1,
        winRate: 1,
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
    { $match: { seasonId: new Types.ObjectId(seasonId), wins: { $gte: 1 } } },
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
          $ifNull: ["$displayName", { $ifNull: ["$user.displayName", "Player"] }],
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
        winRate: 1,
        losses: 1,
        displayName: 1,
        ign: 1,
      },
    },
  ]).option({ maxTimeMS: 8_000 });
}

const getCachedSeasonRanks = unstable_cache(
  async (
    seasonId: string,
    isActive: boolean,
    limit: number,
    offset: number,
  ) => {
    await connectDb();
    const aggregate = isActive
      ? aggregateCurrentRankedPlayers
      : (skip: number, count: number) =>
          aggregateSeasonRankedPlayers(seasonId, skip, count);
    const rows = await aggregate(offset, limit + 1);
    const hasMore = rows.length > limit;
    const players = (hasMore ? rows.slice(0, limit) : rows).map(toPlayerRank);
    return { players, hasMore };
  },
  ["season-rankings"],
  { revalidate: 30, tags: ["global-rankings"] },
);

export async function listSeasonRanks(
  season: Pick<SeasonDoc, "_id" | "status" | "rankingsSnapshottedAt">,
  limit = RANK_PAGE_SIZE,
  offset = 0,
): Promise<{ players: PlayerRank[]; hasMore: boolean }> {
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeOffset = Math.max(0, offset);
  return getCachedSeasonRanks(
    String(season._id),
    season.status === "active" && !season.rankingsSnapshottedAt,
    safeLimit,
    safeOffset,
  );
}

export async function snapshotSeasonRankingsAtMonthEnd(date = new Date()) {
  const nextDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
  if (nextDay.getUTCMonth() === date.getUTCMonth()) {
    return { executed: false, reason: "not-month-end" } as const;
  }

  await connectDb();
  const season = await getOrCreateSeasonForDate(date);
  if (season.rankingsSnapshottedAt) {
    return { executed: false, reason: "already-snapshotted" } as const;
  }

  const seasonId = season._id;
  const target = SeasonPlayerStatModel.collection.name;
  await UserModel.aggregate([
    { $match: { role: { $ne: UserRole.PLATFORM } } },
    {
      $project: {
        _id: {
          $concat: [
            { $toString: { $literal: seasonId } },
            ":",
            { $toString: "$_id" },
          ],
        },
        userId: "$_id",
        seasonId: { $literal: seasonId },
        matchesPlayed: {
          $convert: {
            input: "$matchesPlayed",
            to: "long",
            onError: 0,
            onNull: 0,
          },
        },
        settledMatchesPlayed: {
          $convert: {
            input: "$matchesPlayed",
            to: "long",
            onError: 0,
            onNull: 0,
          },
        },
        inactivityMatchesPlayed: { $literal: 0 },
        wins: {
          $convert: { input: "$wins", to: "long", onError: 0, onNull: 0 },
        },
        displayName: { $ifNull: ["$displayName", "Player"] },
        ign: {
          $let: {
            vars: { name: { $trim: { input: { $ifNull: ["$ign", ""] } } } },
            in: {
              $cond: [
                { $ne: ["$$name", ""] },
                "$$name",
                { $ifNull: ["$displayName", "Player"] },
              ],
            },
          },
        },
      },
    },
    {
      $merge: {
        into: target,
        on: "_id",
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ]).exec();

  const snapshottedAt = new Date();
  await SeasonModel.updateOne(
    { _id: seasonId, rankingsSnapshottedAt: { $exists: false } },
    { $set: { rankingsSnapshottedAt: snapshottedAt, status: "completed" } },
  ).exec();

  return { executed: true, season: season.slug, snapshottedAt };
}

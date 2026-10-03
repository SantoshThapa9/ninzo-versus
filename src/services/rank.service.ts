import { Types } from "mongoose";
import { connectDb } from "@/lib/db/mongoose";
import {
  getRank,
  getWinRate,
  RANK_PAGE_SIZE,
  type PlayerRank,
} from "@/lib/rank";
import type { SeasonDoc } from "@/models/season";
import { UserModel } from "@/models/user";
import { UserRole } from "@/types/enums";

export type { PlayerRank };
export { RANK_PAGE_SIZE };

const numericCounter = (field: "wins" | "matchesPlayed") => ({
  $convert: {
    input: `$${field}`,
    to: "long",
    onError: 0,
    onNull: 0,
  },
});

async function getUserMatchStats(userId: string) {
  const [row] = await UserModel.aggregate<{ wins: number; matches: number }>([
    { $match: { _id: new Types.ObjectId(userId) } },
    {
      $project: {
        _id: 0,
        wins: numericCounter("wins"),
        matches: numericCounter("matchesPlayed"),
      },
    },
  ]);
  return row ?? { wins: 0, matches: 0 };
}

export async function getPlayerRank(userId: string) {
  await connectDb();
  const [user, stats] = await Promise.all([
    UserModel.findById(userId).select("displayName ign").lean(),
    getUserMatchStats(userId),
  ]);
  if (!user) return null;

  const winRate = getWinRate(stats.wins, stats.matches);
  return {
    userId: String(user._id),
    displayName: user.displayName,
    ign: user.ign?.trim() || user.displayName,
    wins: stats.wins,
    matches: stats.matches,
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

async function aggregateRankedPlayers(
  skip: number,
  limit: number,
) {
  return UserModel.aggregate<AggregatedPlayer>([
    { $match: { role: { $ne: UserRole.PLATFORM } } },
    {
      $project: {
        _id: 1,
        wins: numericCounter("wins"),
        matches: numericCounter("matchesPlayed"),
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
  ]);
}

export async function listGlobalRanks(
  _season: Pick<SeasonDoc, "_id" | "startDate" | "endDate">,
  limit = RANK_PAGE_SIZE,
  offset = 0,
): Promise<{ players: PlayerRank[]; hasMore: boolean }> {
  await connectDb();
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const safeOffset = Math.max(0, offset);

  // Fetch one extra row to know if another page exists.
  const rows = await aggregateRankedPlayers(safeOffset, safeLimit + 1);
  const hasMore = rows.length > safeLimit;
  const players = (hasMore ? rows.slice(0, safeLimit) : rows).map(toPlayerRank);

  return { players, hasMore };
}

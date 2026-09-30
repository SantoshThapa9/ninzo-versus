import { Types } from "mongoose";
import { connectDb } from "@/lib/db/mongoose";
import {
  getRank,
  getWinRate,
  RANK_PAGE_SIZE,
  type PlayerRank,
} from "@/lib/rank";
import { MatchModel } from "@/models/match";
import { UserModel } from "@/models/user";
import { MatchStatus, UserRole } from "@/types/enums";

export type { PlayerRank };
export { RANK_PAGE_SIZE };

type AggregatedPlayer = {
  _id: Types.ObjectId;
  wins: number;
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
    matches: player.matches,
    winRate: player.winRate,
    rank: getRank(player.winRate).name,
  };
}

/** Settled 1v1 match stats for a single player — no full-table scan. */
async function getUserMatchStats(userId: string) {
  const oid = new Types.ObjectId(userId);
  const [row] = await MatchModel.aggregate<{ wins: number; matches: number }>([
    {
      $match: {
        status: MatchStatus.SETTLED,
        $or: [
          { creatorId: oid },
          { opponentCaptainId: oid },
        ],
      },
    },
    {
      $group: {
        _id: null,
        wins: {
          $sum: {
            $cond: [
              {
                $or: [
                  {
                    $and: [
                      { $eq: ["$creatorId", oid] },
                      { $eq: ["$winnerTeam", "A"] },
                    ],
                  },
                  {
                    $and: [
                      { $eq: ["$opponentCaptainId", oid] },
                      { $eq: ["$winnerTeam", "B"] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        matches: { $sum: 1 },
      },
    },
  ]);
  return row ?? { wins: 0, matches: 0 };
}

/**
 * Ranked players who have completed ≥1 settled 1v1.
 * Stats come from matches only — users with zero matches never appear.
 */
async function aggregateRankedPlayers(skip: number, limit: number) {
  return MatchModel.aggregate<AggregatedPlayer>([
    { $match: { status: MatchStatus.SETTLED } },
    {
      $lookup: {
        from: "matchparticipants",
        localField: "_id",
        foreignField: "matchId",
        as: "roster",
      },
    },
    {
      $project: {
        winnerTeam: 1,
        participants: {
          $filter: {
            input: {
              $setUnion: [
                [{ id: "$creatorId", team: "A" }],
                {
                  $cond: [
                    { $ifNull: ["$opponentCaptainId", false] },
                    [{ id: "$opponentCaptainId", team: "B" }],
                    [],
                  ],
                },
                {
                  $map: {
                    input: { $ifNull: ["$roster", []] },
                    as: "player",
                    in: { id: "$$player.userId", team: "$$player.team" },
                  },
                },
              ],
            },
            as: "player",
            cond: { $ne: ["$$player.id", null] },
          },
        },
      },
    },
    { $unwind: "$participants" },
    {
      $group: {
        _id: { matchId: "$_id", userId: "$participants.id" },
        team: { $first: "$participants.team" },
        winnerTeam: { $first: "$winnerTeam" },
      },
    },
    {
      $group: {
        _id: "$_id.userId",
        wins: {
          $sum: {
            $cond: [{ $eq: ["$team", "$winnerTeam"] }, 1, 0],
          },
        },
        matches: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        _id: { $ne: null },
        "user.role": { $ne: UserRole.PLATFORM },
      },
    },
    {
      $addFields: {
        winRate: {
          $round: [
            { $multiply: [{ $divide: ["$wins", "$matches"] }, 100] },
            0,
          ],
        },
        displayName: { $ifNull: ["$user.displayName", "Player"] },
        ign: {
          $let: {
            vars: {
              trimmedIgn: {
                $trim: { input: { $ifNull: ["$user.ign", ""] } },
              },
            },
            in: {
              $cond: [
                { $ne: ["$$trimmedIgn", ""] },
                "$$trimmedIgn",
                { $ifNull: ["$user.displayName", "Player"] },
              ],
            },
          },
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
        displayName: 1,
        ign: 1,
      },
    },
  ]);
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

export async function listGlobalRanks(
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

import { connectDb } from "@/lib/db/mongoose";
import { getRank, getWinRate, type RankName } from "@/lib/rank";
import { MatchModel } from "@/models/match";
import { UserModel } from "@/models/user";
import { MatchStatus, UserRole } from "@/types/enums";

export type PlayerRank = {
  userId: string;
  displayName: string;
  ign: string;
  wins: number;
  matches: number;
  winRate: number;
  rank: RankName;
};

async function getSettledMatchStats() {
  const matches = await MatchModel.find({
    status: MatchStatus.SETTLED,
    opponentCaptainId: { $exists: true, $ne: null },
  })
    .select("creatorId opponentCaptainId winnerTeam")
    .lean();
  const stats = new Map<string, { wins: number; matches: number }>();

  for (const match of matches) {
    const participants = [
      { id: String(match.creatorId), team: "A" },
      { id: String(match.opponentCaptainId), team: "B" },
    ];
    for (const participant of participants) {
      const current = stats.get(participant.id) ?? { wins: 0, matches: 0 };
      current.matches += 1;
      if (match.winnerTeam === participant.team) current.wins += 1;
      stats.set(participant.id, current);
    }
  }

  return stats;
}

function toPlayerRank(
  user: { _id: unknown; displayName: string; ign?: string | null },
  stats: { wins: number; matches: number } = { wins: 0, matches: 0 },
): PlayerRank {
  const winRate = getWinRate(stats.wins, stats.matches);
  return {
    userId: String(user._id),
    displayName: user.displayName,
    ign: user.ign?.trim() || user.displayName,
    ...stats,
    winRate,
    rank: getRank(winRate).name,
  };
}

export async function getPlayerRank(userId: string) {
  await connectDb();
  const [user, stats] = await Promise.all([
    UserModel.findById(userId).select("displayName ign").lean(),
    getSettledMatchStats(),
  ]);
  if (!user) return null;
  return toPlayerRank(user, stats.get(userId));
}

export async function listGlobalRanks(limit = 100) {
  await connectDb();
  const [users, stats] = await Promise.all([
    UserModel.find({ role: UserRole.USER }).select("displayName ign").lean(),
    getSettledMatchStats(),
  ]);

  return users
    .map((user) => toPlayerRank(user, stats.get(String(user._id))))
    .sort((left, right) => right.winRate - left.winRate || right.wins - left.wins || right.matches - left.matches || left.ign.localeCompare(right.ign))
    .slice(0, limit);
}

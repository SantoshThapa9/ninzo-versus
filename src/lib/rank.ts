export const RANKS = [
  {
    name: "Rookie",
    minimumScore: 0,
    className: "text-slate-300",
    image: "/ranks/rookie.webp",
  },
  {
    name: "Elite",
    minimumScore: 15,
    className: "text-cyan-300",
    image: "/ranks/elite.webp",
  },
  {
    name: "Champion",
    minimumScore: 25,
    className: "text-violet-300",
    image: "/ranks/champion.webp",
  },
  {
    name: "Mythic",
    minimumScore: 35,
    className: "text-fuchsia-300",
    image: "/ranks/mythic.webp",
  },
  {
    name: "Legend",
    minimumScore: 45,
    className: "text-amber-300",
    image: "/ranks/legend.webp",
  },
  {
    name: "Immortal",
    minimumScore: 55,
    className: "text-rose-300",
    image: "/ranks/immortal.webp",
  },
] as const;

export type RankName = (typeof RANKS)[number]["name"];

export const RANK_PAGE_SIZE = 5;

export type PlayerRank = {
  userId: string;
  displayName: string;
  ign: string;
  wins: number;
  losses: number;
  matches: number;
  rankScore: number;
  rank: RankName;
};

export function getRank(rankScore: number) {
  return (
    [...RANKS].reverse().find((rank) => rankScore >= rank.minimumScore) ??
    RANKS[0]
  );
}

export function getRankScore(wins: number, matches: number) {
  const losses = Math.max(matches - wins, 0);
  return Math.max(wins * 10 - losses * 5, 0);
}

export const RANKS = [
  { name: "Rookie", minimumWinRate: 0, className: "text-slate-300" },
  { name: "Elite", minimumWinRate: 51, className: "text-cyan-300" },
  { name: "Champion", minimumWinRate: 61, className: "text-violet-300" },
  { name: "Mythic", minimumWinRate: 71, className: "text-fuchsia-300" },
  { name: "Legend", minimumWinRate: 81, className: "text-amber-300" },
  { name: "Immortal", minimumWinRate: 91, className: "text-rose-300" },
] as const;

export type RankName = (typeof RANKS)[number]["name"];

export function getRank(winRate: number) {
  return [...RANKS].reverse().find((rank) => winRate >= rank.minimumWinRate) ?? RANKS[0];
}

export function getWinRate(wins: number, matches: number) {
  return matches === 0 ? 0 : Math.round((wins / matches) * 100);
}

const MONTH_SUFFIXES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthlyRankStatField =
  | `matchesPlayed${(typeof MONTH_SUFFIXES)[number]}${number}`
  | `wins${(typeof MONTH_SUFFIXES)[number]}${number}`;

export function getMonthlyRankStatFields(date: Date): {
  matchesPlayed: MonthlyRankStatField;
  wins: MonthlyRankStatField;
} {
  const suffix = MONTH_SUFFIXES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return {
    matchesPlayed: `matchesPlayed${suffix}${year}`,
    wins: `wins${suffix}${year}`,
  };
}

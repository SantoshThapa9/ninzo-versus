export function getSeasonPlayerStatId(seasonId: string, userId: string) {
  return `${seasonId}:${userId}`;
}

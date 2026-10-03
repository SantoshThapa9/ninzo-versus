import { RANK_PAGE_SIZE } from "@/lib/rank";
import { listSeasonRanks } from "@/services/rank.service";
import { getSeasonBySlug } from "@/services/season.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? RANK_PAGE_SIZE);

  if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(limit) || limit < 1) {
    return Response.json({ error: "Invalid pagination params" }, { status: 400 });
  }

  const season = await getSeasonBySlug(searchParams.get("season") ?? undefined);
  const { players, hasMore } = await listSeasonRanks(season, limit, offset);
  return Response.json({ players, hasMore, offset, limit });
}

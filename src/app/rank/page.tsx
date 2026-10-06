import { Card } from "@/components/ui/card";
import { RankingsList } from "@/components/rank/rankings-list";
import { listSeasonRanks } from "@/services/rank.service";
import { listCompletedEventResults } from "@/services/event.service";
import { listSeasons } from "@/services/season.service";
import { CalendarDays, Trophy } from "lucide-react";
import Link from "next/link";
import { RankFilters } from "@/components/rank/rank-filters";
import { PlayerRankCard } from "@/components/rank/playerRankCard";

type RankTab = "rankings" | "event-results";

export default async function RankPage({ searchParams }: PageProps<"/rank">) {
  const params = await searchParams;
  const tab =
    params.tab === "event-results"
      ? "event-results"
      : ("rankings" satisfies RankTab);
  const seasons = await listSeasons();
  const season =
    seasons.find(
      (availableSeason) =>
        availableSeason.slug ===
        (typeof params.season === "string" ? params.season : undefined),
    ) ?? seasons[0];
  if (!season) throw new Error("No monthly seasons are available.");
  const [rankingPage, eventResults] = await Promise.all([
    tab === "rankings"
      ? listSeasonRanks(season)
      : Promise.resolve({ players: [], hasMore: false }),
    tab === "event-results"
      ? listCompletedEventResults(season)
      : Promise.resolve([]),
  ]);
  return (
    <div className="grid gap-5 pb-2">
      <div data-tour="rank-heading">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={18} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">
            {tab === "rankings" ? "Season standings" : "Full Map results"}
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold">Rank</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {tab === "rankings"
            ? "Top 10 players get 10 NV tokens each at season end."
            : "Season results from completed Full Map events."}
        </p>
      </div>
      <PlayerRankCard />

      <div
        role="tablist"
        aria-label="Rank page sections"
        className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 text-sm font-bold"
      >
        <Link
          href={`/rank?season=${season.slug}`}
          prefetch={false}
          role="tab"
          aria-selected={tab === "rankings"}
          className={`rounded-lg px-3 py-2 text-center transition ${tab === "rankings" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}
        >
          1v1 rankings
        </Link>
        <Link
          href={`/rank?season=${season.slug}&tab=event-results`}
          prefetch={false}
          role="tab"
          aria-selected={tab === "event-results"}
          className={`rounded-lg px-3 py-2 text-center transition ${tab === "event-results" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}
        >
          Full Map results
        </Link>
      </div>
      <RankFilters
        seasons={seasons.map(({ slug, name, endDate }) => ({
          slug,
          name,
          daysInMonth: endDate.getUTCDate(),
        }))}
        selectedSlug={season.slug}
        tab={tab}
      />

      {tab === "event-results" ? (
        eventResults.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              No completed Full Map event results yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {eventResults.map((event) => (
              <Card key={event.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{event.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <CalendarDays size={13} />
                      {new Date(event.eventDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {event.format}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--accent-2)]/15 px-2 py-1 text-xs font-bold text-[var(--accent-2)]">
                    Full Map
                  </span>
                </div>
                {event.placements.length ? (
                  <div className="mt-4 grid gap-2">
                    {event.placements.map((result) => (
                      <div
                        key={result.placement}
                        className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm"
                      >
                        <span className="w-6 font-extrabold text-[var(--accent)]">
                          #{result.placement}
                        </span>
                        <span className="truncate font-semibold">
                          {result.igns.join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Placements were not published for this event.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          <RankingsList
            key={`${season.slug}:${JSON.stringify(rankingPage.players)}:${rankingPage.hasMore}`}
            initialPlayers={rankingPage.players}
            initialHasMore={rankingPage.hasMore}
            seasonSlug={season.slug}
          />
        </>
      )}
    </div>
  );
}

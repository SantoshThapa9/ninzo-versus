import { Card } from "@/components/ui/card";
import { RankingsList } from "@/components/rank/rankings-list";
import { RANKS } from "@/lib/rank";
import { listGlobalRanks } from "@/services/rank.service";
import { listCompletedEventResults } from "@/services/event.service";
import { CalendarDays, Trophy } from "lucide-react";
import Link from "next/link";

type RankTab = "rankings" | "event-results";

export default async function RankPage({ searchParams }: PageProps<"/rank">) {
  const tab =
    (await searchParams).tab === "event-results"
      ? "event-results"
      : ("rankings" satisfies RankTab);
  const [rankingPage, eventResults] = await Promise.all([
    tab === "rankings"
      ? listGlobalRanks()
      : Promise.resolve({ players: [], hasMore: false }),
    tab === "event-results" ? listCompletedEventResults() : Promise.resolve([]),
  ]);
  return (
    <div className="grid gap-5 pb-2">
      <div data-tour="rank-heading">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={18} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">
            Global standings
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold">Rank</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ranks use wins and matches from settled 1v1 challenges only.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Rank page sections"
        className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 text-sm font-bold"
      >
        <Link
          href="/rank"
          role="tab"
          aria-selected={tab === "rankings"}
          className={`rounded-lg px-3 py-2 text-center transition ${tab === "rankings" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}
        >
          1v1 rankings
        </Link>
        <Link
          href="/rank?tab=event-results"
          role="tab"
          aria-selected={tab === "event-results"}
          className={`rounded-lg px-3 py-2 text-center transition ${tab === "event-results" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}
        >
          Full Map results
        </Link>
      </div>

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
          <Card className="overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                <span>Rank levels</span>

                <span className="text-xs text-[var(--muted)] transition-transform duration-200 group-open:rotate-180">
                  ▼
                </span>
              </summary>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {RANKS.map((rank, index) => (
                  <div
                    key={rank.name}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className={`font-bold ${rank.className}`}>{rank.name}</p>

                    <p className="mt-0.5 text-[var(--muted)]">
                      {index === 0
                        ? "≤49%"
                        : index === RANKS.length - 1
                          ? "90–100%"
                          : `${rank.minimumWinRate}–${
                              RANKS[index + 1].minimumWinRate - 1
                            }%`}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </Card>
          <RankingsList
            initialPlayers={rankingPage.players}
            initialHasMore={rankingPage.hasMore}
          />
        </>
      )}
    </div>
  );
}

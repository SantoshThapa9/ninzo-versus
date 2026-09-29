import { Card } from "@/components/ui/card";
import { getRank, RANKS } from "@/lib/rank";
import { listGlobalRanks } from "@/services/rank.service";
import { listCompletedEventResults } from "@/services/event.service";
import { CalendarDays, Crown, Medal, Trophy } from "lucide-react";
import Link from "next/link";

type RankTab = "rankings" | "event-results";

export default async function RankPage({ searchParams }: PageProps<"/rank">) {
  const tab = (await searchParams).tab === "event-results" ? "event-results" : "rankings" satisfies RankTab;
  const [players, eventResults] = await Promise.all([
    listGlobalRanks(),
    tab === "event-results" ? listCompletedEventResults() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-5 pb-2">
      <div data-tour="rank-heading">
        <div className="flex items-center gap-2 text-[var(--accent)]"><Trophy size={18} /><p className="text-xs font-bold uppercase tracking-[0.16em]">Global standings</p></div>
        <h1 className="mt-1 text-2xl font-extrabold">Rank</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Ranks use wins and matches from settled 1v1 challenges only.</p>
      </div>

      <div role="tablist" aria-label="Rank page sections" className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 text-sm font-bold">
        <Link href="/rank" role="tab" aria-selected={tab === "rankings"} className={`rounded-lg px-3 py-2 text-center transition ${tab === "rankings" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}>1v1 rankings</Link>
        <Link href="/rank?tab=event-results" role="tab" aria-selected={tab === "event-results"} className={`rounded-lg px-3 py-2 text-center transition ${tab === "event-results" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-white"}`}>Full Map results</Link>
      </div>

      {tab === "event-results" ? eventResults.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">No completed Full Map event results yet.</p></Card>
      ) : (
        <div className="grid gap-2">
          {eventResults.map((event) => (
            <Card key={event.id}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{event.name}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]"><CalendarDays size={13} />{new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {event.format}</p></div><span className="shrink-0 rounded-full bg-[var(--accent-2)]/15 px-2 py-1 text-xs font-bold text-[var(--accent-2)]">Full Map</span></div>
              {event.placements.length ? <div className="mt-4 grid gap-2">{event.placements.map((result) => <div key={result.placement} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm"><span className="w-6 font-extrabold text-[var(--accent)]">#{result.placement}</span><span className="truncate font-semibold">{result.igns.join(", ")}</span></div>)}</div> : <p className="mt-4 text-sm text-[var(--muted)]">Placements were not published for this event.</p>}
            </Card>
          ))}
        </div>
      ) : <>
        <Card className="grid gap-2">
          <h2 className="text-sm font-bold">Rank levels</h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {RANKS.map((rank, index) => <div key={rank.name} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><p className={`font-bold ${rank.className}`}>{rank.name}</p><p className="mt-0.5 text-[var(--muted)]">{index === 0 ? "≤50%" : index === RANKS.length - 1 ? "91–100%" : `${rank.minimumWinRate}–${RANKS[index + 1].minimumWinRate - 1}%`}</p></div>)}
          </div>
        </Card>
        {players.length === 0 ? <Card><p className="text-sm text-[var(--muted)]">No ranked players yet. Complete a 1v1 challenge to appear here.</p></Card> : <div className="grid gap-2">{players.map((player, index) => {
          const rank = getRank(player.winRate);
          return <Card key={player.userId} className="flex items-center gap-3 py-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-extrabold text-[var(--muted)]">{index < 3 ? <Crown size={18} className={index === 0 ? "text-yellow-300" : index === 1 ? "text-slate-300" : "text-amber-600"} /> : index + 1}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{player.ign}</p><p className="text-xs text-[var(--muted)]">{player.wins} wins · {player.matches} matches</p></div><div className="text-right"><p className={`flex items-center justify-end gap-1 text-sm font-extrabold ${rank.className}`}><Medal size={15} />{player.rank}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{player.winRate}% win rate</p></div></Card>;
        })}</div>}
      </>}
    </div>
  );
}

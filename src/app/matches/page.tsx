import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listMatchesForUser } from "@/services/match.service";
import { listPublicEvents } from "@/services/event.service";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarDays, ChevronRight, Coins, Trophy, UsersRound } from "lucide-react";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "completed", label: "Completed" },
  { key: "on_hold", label: "On Hold" },
  { key: "disqualified", label: "Disqualified" },
] as const;

function formatDate(value?: string | Date) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getExpiryDate(completedAt?: string | Date) {
  if (!completedAt) return undefined;
  const completed = new Date(completedAt).getTime();
  return Number.isNaN(completed) ? undefined : new Date(completed + 3 * 24 * 60 * 60 * 1000);
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const selected = FILTERS.some((item) => item.key === params.filter) ? (params.filter as (typeof FILTERS)[number]["key"]) : "open";
  const [events, matches] = await Promise.all([
    listPublicEvents(),
    listMatchesForUser(session.user.id, selected),
  ]);

  return (
    <div className="grid gap-5 pb-2">
      <section className="grid gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Trophy size={18} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Tournament hub</p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold">Competitive events</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Join the next battle and play for the prize pool.</p>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
        ) : (
          events.map((event) => (
            <Link key={String(event._id)} href={`/events/${String(event._id)}`} className="group block">
              <Card className="relative overflow-hidden border-white/15 p-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--accent-2)]/65 group-hover:shadow-[0_18px_44px_rgba(0,224,198,0.12)]">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/br.png')" }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080d14]/95 via-[#080d14]/80 to-[#080d14]/45" />
                <div className="relative p-4 text-white sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-2)]">Battle royale event</p>
                      <h2 className="mt-1 truncate text-lg font-extrabold">{event.name}</h2>
                    </div>
                    <Badge className="shrink-0 border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15">{event.status}</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"><CalendarDays size={15} className="text-[var(--accent)]" /><span>{new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"><UsersRound size={15} className="text-[var(--accent)]" /><span>{event.reservedSlots}/{event.maxSlots} slots</span></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-white/80"><Coins size={14} className="text-yellow-300" /> {event.entryFeeCoins} NV <span className="text-white/35">•</span> {event.format}</p>
                    <div className="flex items-center gap-1 font-bold text-[var(--accent-2)]">View event <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></div>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </section>

      <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Matches</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Open, completed, on hold, and disqualified match history.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = filter.key === selected;
          const href = `/matches?filter=${filter.key}`;
          return (
            <Link key={filter.key} href={href}>
              <Badge className={active ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/10 bg-white/5 text-white"}>
                {filter.label}
              </Badge>
            </Link>
          );
        })}
      </div>

      {matches.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No {selected === "open" ? "open" : selected.replace("_", " ")} matches yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {matches.map((match) => {
            const playerA = match.creatorIgn ?? "Player A";
            const playerB = match.opponentIgn ?? "Player B";
            const winnerName = match.status === "settled" && match.winnerIgn ? match.winnerIgn : null;
            return (
              <Link key={String(match._id)} href={`/clash/${String(match._id)}`}>
                <Card className="transition hover:border-[var(--accent)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold">{playerA} vs {playerB}</h2>
                    <Badge>{match.status === "settled" ? "Completed" : match.status === "awaiting_evidence" ? "Awaiting Evidence" : match.status === "analyzing" ? "Analyzing Evidence" : match.status === "disputed" ? "On Hold" : match.status === "cancelled" ? "Disqualified" : "Open"}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                    <p>Created Date: {formatDate(match.createdAt)}</p>
                    {match.status === "settled" ? (
                      <>
                      <p>Expiry Date: {formatDate(getExpiryDate(match.completedAt))}</p>
                      {winnerName ? <p className="text-[var(--accent-2)]">Winner: {winnerName}</p> : null}
                      {!winnerName ? <p className="text-[var(--accent-2)]">Result: Draw — returns split after platform fee</p> : null}
                      </>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      </section>
    </div>
  );
}

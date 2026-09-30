import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listMatchesForUser } from "@/services/match.service";
import { listPublicEvents } from "@/services/event.service";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CalendarDays,
  ChevronRight,
  Coins,
  Trophy,
  UsersRound,
} from "lucide-react";
import { EventCard } from "@/components/events/EventCard";

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
  return Number.isNaN(completed)
    ? undefined
    : new Date(completed + 3 * 24 * 60 * 60 * 1000);
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const selected = FILTERS.some((item) => item.key === params.filter)
    ? (params.filter as (typeof FILTERS)[number]["key"])
    : "open";
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
            <p className="text-xs font-bold uppercase tracking-[0.16em]">
              Tournament hub
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold">Competitive Events</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Join the next battle and play for the prize pool.
          </p>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
        ) : (
          events.map((event) => (
            <EventCard key={String(event._id)} event={event} />
          ))
        )}
      </section>

      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open, completed, on hold, and disqualified match history.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = filter.key === selected;
            const href = `/matches?filter=${filter.key}`;
            return (
              <Link key={filter.key} href={href}>
                <Badge
                  className={
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                      : "border-white/10 bg-white/5 text-white"
                  }
                >
                  {filter.label}
                </Badge>
              </Link>
            );
          })}
        </div>

        {matches.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              No {selected === "open" ? "open" : selected.replace("_", " ")}{" "}
              matches yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {matches.map((match) => {
              const playerA = match.creatorIgn ?? "Player A";
              const playerB = match.opponentIgn ?? "Player B";
              const winnerName =
                match.status === "settled" && match.winnerIgn
                  ? match.winnerIgn
                  : null;
              return (
                <Link
                  key={String(match._id)}
                  href={`/clash/${String(match._id)}`}
                >
                  <Card className="transition hover:border-[var(--accent)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-bold">
                        {playerA} vs {playerB}
                      </h2>
                      <Badge>
                        {match.status === "settled"
                          ? "Completed"
                          : match.status === "awaiting_evidence"
                            ? "Awaiting Evidence"
                            : match.status === "analyzing"
                              ? "Analyzing Evidence"
                              : match.status === "disputed"
                                ? "On Hold"
                                : match.status === "cancelled"
                                  ? "Disqualified"
                                  : "Open"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                      <p>Created Date: {formatDate(match.createdAt)}</p>
                      {match.status === "settled" ? (
                        <>
                          <p>
                            Expiry Date:{" "}
                            {formatDate(getExpiryDate(match.completedAt))}
                          </p>
                          {winnerName ? (
                            <p className="text-[var(--accent-2)]">
                              Winner: {winnerName}
                            </p>
                          ) : null}
                          {!winnerName ? (
                            <p className="text-[var(--accent-2)]">
                              Result: Draw — returns split after platform fee
                            </p>
                          ) : null}
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

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PreviousMatch = {
  _id: string;
  createdAt: string;
  completedAt?: string;
  status: string;
  creatorIgn?: string;
  opponentIgn?: string;
  winnerIgn?: string | null;
  format?: number;
  winnerTeam?: "A" | "B" | null;
  winnerPayout?: number;
  creatorId?: string;
  opponentCaptainId?: string;
  provisionalResult?: "WIN" | "LOSS" | "HOLD" | null;
};

function formatDate(value?: string) {
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

function getExpiryDate(completedAt?: string) {
  if (!completedAt) return undefined;
  const completed = new Date(completedAt).getTime();
  return Number.isNaN(completed) ? undefined : new Date(completed + 3 * 24 * 60 * 60 * 1000).toISOString();
}

export function PreviousMatchesList({ matches }: { matches: PreviousMatch[] }) {
  if (matches.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">No recent completed matches yet. Matches leave history here for 3 days after completion.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {matches.map((match) => {
        const winnerName = match.winnerIgn ?? null;
        return (
          <Link key={match._id} href={`/clash/${match._id}`}>
            <Card className="transition hover:border-[var(--accent)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{match.creatorIgn ?? "Player A"} vs {match.opponentIgn ?? "Player B"}</h2>
                <Badge>{match.status === "disputed" ? "Admin review" : "Completed"}</Badge>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                <p>Created Date: {formatDate(match.createdAt)}</p>
                <p>Expiry Date: {formatDate(getExpiryDate(match.completedAt))}</p>
                {winnerName ? <p className="text-[var(--accent-2)]">Winner: {winnerName}</p> : null}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

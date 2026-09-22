import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { matchRepository } from "@/repositories/match.repository";
import { resultRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLiveMatchAction, adminSettleAction } from "@/app/actions/match";
import Link from "next/link";

function formatDate(value?: string | Date) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AdminMatchesPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  await connectDb();
  const matches = await matchRepository.list({});
  const matchesWithEvidence = await Promise.all(matches.map(async (match) => {
    const [evidence, participants] = await Promise.all([
      resultRepository.listForMatch(String(match._id)),
      matchRepository.listParticipants(String(match._id)),
    ]);
    const playerA = participants.find((player) => String(player.userId) === String(match.creatorId))?.ign ?? match.creatorIgn ?? "Player 1";
    const playerB = participants.find((player) => String(player.userId) === String(match.opponentCaptainId))?.ign ?? "Player 2";
    return { match, evidence, playerA, playerB };
  }));

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Clash Squad matches</h1>
      {matchesWithEvidence.map(({ match, evidence, playerA, playerB }) => (
        <Card key={String(match._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/clash/${String(match._id)}`} className="font-bold">
              {playerA} vs {playerB} • {match.format}v{match.format} • {match.status}
            </Link>
            <Badge>{match.acceptedStake ?? `${match.stakeMin}-${match.stakeMax}`}</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">Created Date: {formatDate(match.createdAt)}</p>
          {["awaiting_evidence", "result_review", "disputed"].includes(match.status) ? (
            <div className="mt-3">
              <p className="text-sm text-[var(--muted)]">{match.status === "awaiting_evidence" ? "Waiting for player evidence. You can make a final decision now if needed." : <>AI recommendation: <span className="font-semibold text-[var(--accent-2)]">{match.aiWinnerRecommendation ?? "inconclusive"}</span></>}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {evidence.map((item) => {
                  const imageUrl = `/api/clash/${String(match._id)}/evidence/${String(item._id)}`;
                  return <a key={String(item._id)} href={imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-white/10"><img src={imageUrl} alt={`Screenshot from ${String(item.userId)}`} className="aspect-video w-full object-cover" /></a>;
                })}
              </div>
            </div>
          ) : null}
          {match.status === "accepted" ? <form action={adminLiveMatchAction} className="mt-3 grid gap-2">
            <input type="hidden" name="matchId" value={String(match._id)} />
            <Label>Room ID</Label>
            <Input name="roomId" />
            <Label>Room password</Label>
            <Input name="roomPassword" type="password" />
            <Button type="submit" size="sm">
              Set live
            </Button>
          </form> : null}
          {["awaiting_evidence", "result_review", "disputed"].includes(match.status) ? <form action={adminSettleAction} className="mt-3 grid gap-2">
            <input type="hidden" name="matchId" value={String(match._id)} />
            <select name="winnerTeam" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3">
              <option value="A">Winner: {playerA}</option>
              <option value="B">Winner: {playerB}</option>
              <option value="DRAW">Draw — refund both players</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Confirm final decision
            </Button>
          </form> : null}
        </Card>
      ))}
    </div>
  );
}

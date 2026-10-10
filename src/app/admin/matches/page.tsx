import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { matchRepository } from "@/repositories/match.repository";
import { resultRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { adminSettleAction } from "@/app/actions/match";
import { getCurrentUserIdentities } from "@/services/player-profile.service";
import Link from "next/link";
import { MatchStatus } from "@/types/enums";

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

export default async function AdminMatchesPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  await connectDb();
  const matches = await matchRepository.list(
    { status: MatchStatus.DISPUTED },
    100,
  );
  const matchIds = matches.map((match) => String(match._id));
  const [allEvidence, allParticipants] = await Promise.all([
    resultRepository.listForMatches(matchIds),
    matchRepository.listParticipantsForMatches(matchIds),
  ]);
  const userIds = [
    ...new Set(
      matches.flatMap((match) => [
        String(match.creatorId),
        ...(match.opponentCaptainId ? [String(match.opponentCaptainId)] : []),
        ...allParticipants.map((player) => String(player.userId)),
      ]),
    ),
  ];
  const identities = await getCurrentUserIdentities(userIds);
  const participantsByMatch = new Map<string, typeof allParticipants>();
  const evidenceByMatch = new Map<string, typeof allEvidence>();
  for (const participant of allParticipants) {
    const matchId = String(participant.matchId);
    participantsByMatch.set(matchId, [
      ...(participantsByMatch.get(matchId) ?? []),
      participant,
    ]);
  }
  for (const evidence of allEvidence) {
    const matchId = String(evidence.matchId);
    evidenceByMatch.set(matchId, [
      ...(evidenceByMatch.get(matchId) ?? []),
      evidence,
    ]);
  }
  const matchesWithEvidence = matches.map((match) => {
    const matchId = String(match._id);
    const participants = participantsByMatch.get(matchId) ?? [];
    const creator = participants.find(
      (player) => String(player.userId) === String(match.creatorId),
    );
    const opponent = participants.find(
      (player) => String(player.userId) === String(match.opponentCaptainId),
    );
    return {
      match,
      evidence: evidenceByMatch.get(matchId) ?? [],
      playerA:
        identities.get(String(match.creatorId))?.ign ??
        creator?.ign ??
        match.creatorIgn ??
        "Player 1",
      playerB:
        identities.get(String(match.opponentCaptainId))?.ign ??
        opponent?.ign ??
        "Player 2",
    };
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Clash Squad matches for review</h1>
      {matchesWithEvidence.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No conflicted matches need review.
        </p>
      ) : null}
      {matchesWithEvidence.map(({ match, evidence, playerA, playerB }) => (
        <Card key={String(match._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/clash/${String(match._id)}`} className="font-bold">
              {playerA} vs {playerB} • {match.format}v{match.format} •{" "}
              {match.status}
            </Link>
            <Badge>
              {match.acceptedStake ?? `${match.stakeMin}-${match.stakeMax}`}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Created Date: {formatDate(match.createdAt)}
          </p>
          <div className="mt-3">
            <p className="text-sm text-[var(--muted)]">
              AI recommendation:{" "}
              <span className="font-semibold text-[var(--accent-2)]">
                {match.aiWinnerRecommendation ?? "inconclusive"}
              </span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {evidence.map((item) => {
                const imageUrl = `/api/clash/${String(match._id)}/evidence/${String(item._id)}`;
                return (
                  <a
                    key={String(item._id)}
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg border border-white/10"
                  >
                    <img
                      src={imageUrl}
                      alt={`Screenshot from ${String(item.userId)}`}
                      className="aspect-video w-full object-cover"
                    />
                  </a>
                );
              })}
            </div>
          </div>
          <form action={adminSettleAction} className="mt-3 grid gap-2">
            <input type="hidden" name="matchId" value={String(match._id)} />
            <select
              name="winnerTeam"
              className="h-11 rounded-xl border border-white/10 bg-black/30 px-3"
            >
              <option value="A">Winner: {playerA}</option>
              <option value="B">Winner: {playerB}</option>
              <option value="DRAW">Draw — refund both players</option>
            </select>
            <PendingSubmitButton
              type="submit"
              variant="secondary"
              size="sm"
              pendingLabel="Settling..."
            >
              Confirm final decision
            </PendingSubmitButton>
          </form>
        </Card>
      ))}
    </div>
  );
}

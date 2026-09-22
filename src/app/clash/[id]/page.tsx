import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMatchForUser } from "@/services/match.service";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { acceptMatchAction } from "@/app/actions/match";
import { MatchChat } from "@/components/match/match-chat";
import { UserRole } from "@/types/enums";

export default async function ClashDetailPage({
  params,
}: PageProps<"/clash/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const data = await getMatchForUser(
    session.user.id,
    id,
    session.user.role === UserRole.ADMIN,
  );
  const match = data.match as {
    _id: string;
    format: number;
    status: string;
    stakeMin: number;
    stakeMax: number;
    acceptedStake?: number;
    rules: string;
    creatorIgn: string;
    creatorId: string;
    opponentCaptainId?: string;
    platformFeePercent: number;
    winnerPayout?: number;
    prizePool?: number;
    completedBy?: string[];
    aiWinnerRecommendation?: string;
  };
  const players = data.players as {
    userId: string;
    ign: string;
    uid: string;
  }[];
  const isCreator = match.creatorId === session.user.id;
  const isParticipant =
    isCreator || match.opponentCaptainId === session.user.id;
  const creator = players.find((player) => player.userId === match.creatorId);
  const opponent = players.find((player) => player.userId !== match.creatorId);
  const playerLabel = (
    player: { userId: string; ign: string; uid: string } | undefined,
  ) =>
    `${player?.userId === session.user.id ? "You" : (player?.ign ?? "Player")} (${player?.uid ?? "UID not set"})`;
  const acceptedPool = match.acceptedStake ? match.acceptedStake * 2 : 0;
  const winnerPrize =
    acceptedPool - Math.round((acceptedPool * match.platformFeePercent) / 100);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {match.format}v{match.format}
          </h1>
          <Badge>{match.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{match.rules}</p>
        <p className="mt-3 break-words text-sm">
          {match.stakeMin === match.stakeMax
            ? `Stake ${match.stakeMin} NV each`
            : `Stake range ${match.stakeMin}–${match.stakeMax} NV each`}{" "}
          <span className="hidden sm:inline">•</span>
          <span className="block sm:inline">
            {" "}
            Creator: {isCreator ? "You" : match.creatorIgn}
          </span>
        </p>
        {match.acceptedStake ? (
          <p className="mt-2 text-sm">
            Stake {match.acceptedStake} NV each • Prize pool {acceptedPool} NV •
            Winner receives {winnerPrize} NV
          </p>
        ) : null}
      </Card>
      <Card>
        <h2 className="mb-2 font-bold">Match rules</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
          <li>
            Use only the agreed custom-room settings and follow the rules above.
          </li>
          <li>Do not share room credentials outside this private match.</li>
          <li>
            Either captain can end the match; then each captain submits one
            result screenshot.
          </li>
          <li>AI analyses both result screenshots to determine the winner.</li>
        </ul>
      </Card>
      {match.status === "open" && !isCreator ? (
        <Card>
          <h2 className="mb-1 font-bold">Accept challenge</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Your selected stake is locked as soon as you accept.
          </p>
          <ActionForm
            action={acceptMatchAction}
            submitLabel="Lock accepted stake"
          >
            <input type="hidden" name="matchId" value={id} />
            <div>
              <Label htmlFor="stake">Your stake (NV)</Label>
              <Input
                id="stake"
                name="stake"
                type="number"
                min={match.stakeMin}
                max={match.stakeMax}
                required
              />
            </div>
            <p className="text-sm text-[var(--muted)]">
              Your saved In Game Name and UID from your profile will be used
              when you accept.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="warning" required className="mt-1" />
              I agree to follow the match rules shown above.
            </label>
          </ActionForm>
        </Card>
      ) : null}
      {isParticipant &&
      [
        "accepted",
        "live",
        "awaiting_evidence",
        "analyzing",
        "result_review",
        "disputed",
        "settled",
      ].includes(match.status) ? (
        <Card>
          <h2 className="mb-1 font-bold">Private match chat</h2>
          <p className="mb-3 break-words text-sm text-[var(--accent-2)]">
            {playerLabel(creator)} vs {playerLabel(opponent)}
          </p>
          <MatchChat matchId={id} currentUserId={session.user.id} />
        </Card>
      ) : null}
    </div>
  );
}

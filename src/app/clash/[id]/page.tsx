import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMatchForUser } from "@/services/match.service";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { acceptMatchAction, deleteMatchAction } from "@/app/actions/match";
import { MatchChat } from "@/components/match/match-chat";
import { ClashStatusSync } from "@/components/match/clash-status-sync";
import { UserRole } from "@/types/enums";
import { ShieldCheck, Swords, Trash2 } from "lucide-react";

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
    rounds?: number;
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
  }[];

  const isCreator = match.creatorId === session.user.id;

  const isParticipant =
    isCreator || match.opponentCaptainId === session.user.id;

  const creator = players.find((player) => player.userId === match.creatorId);

  const opponent = players.find((player) => player.userId !== match.creatorId);

  const playerLabel = (player: { userId: string; ign: string } | undefined) =>
    player?.userId === session.user.id ? "You" : (player?.ign ?? "Player");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 pb-2">
      <ClashStatusSync isCreator={isCreator} status={match.status} />

      {/* Match Header */}
      <Card className="relative overflow-hidden border-white/10 bg-transparent p-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cs.png')" }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#070a10]/95 via-[#070a10]/85 to-[#070a10]/60" />

        <div className="relative p-4 sm:p-5">
          {/* Header label */}
          <div className="mb-3 flex items-center gap-2 text-[var(--accent-2)]">
            <Swords size={16} />

            <p className="text-xs font-bold uppercase tracking-[0.16em]">
              Clash Arena
            </p>
          </div>

          {/* Title + Status */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white">
              {match.format}v{match.format}
            </h1>

            <Badge className="border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15 px-3 py-1 text-xs">
              {match.status}
            </Badge>
          </div>

          {/* Rules */}
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/70">
            {match.rules}
          </p>
          {/* Match info */}
          <div className="mt-3  gap-x-3 gap-y-1 text-sm text-white/80">
            <span>{match.rounds ?? 7} rounds</span>

            <p>Creator: {isCreator ? "You" : match.creatorIgn}</p>
          </div>

          {match.acceptedStake ? (
            <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
              Registered with {match.acceptedStake} NV Tokens each.
            </div>
          ) : null}
        </div>
      </Card>

      {/* Accept Challenge */}
      {match.status === "open" && !isCreator ? (
        <Card className="border-white/10 p-4">
          <div className="mb-4">
            <p className="mb-1 text-sm font-medium text-amber-400">
              Join Match
            </p>

            <h2 className="text-xl font-bold">Accept challenge</h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Choose your match registration within the allowed token range.
            </p>
          </div>

          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-sm text-[var(--muted)]">Registration range</p>

            <p className="mt-1 text-lg font-bold text-white">
              {match.stakeMin} – {match.stakeMax}{" "}
              <span className="text-sm font-medium text-[var(--muted)]">
                NV Tokens
              </span>
            </p>
          </div>

          <ActionForm
            action={acceptMatchAction}
            submitLabel="Register for match"
          >
            <input type="hidden" name="matchId" value={id} />

            <div className="space-y-2">
              <Label htmlFor="stake">Your match registration</Label>

              <Input
                id="stake"
                name="stake"
                type="number"
                min={match.stakeMin}
                max={match.stakeMax}
                defaultValue={match.stakeMin}
                step="0.01"
                required
                placeholder={`${match.stakeMin} – ${match.stakeMax}`}
              />

              <p className="text-xs text-[var(--muted)]">
                Enter an amount between {match.stakeMin} and {match.stakeMax} NV
                Tokens.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <input
                type="checkbox"
                name="warning"
                required
                className="mt-1 h-4 w-4 accent-emerald-400"
              />

              <span className="leading-6 text-[var(--muted)]">
                I agree to follow the match rules shown above.
              </span>
            </label>
          </ActionForm>
        </Card>
      ) : null}

      {/* Delete Challenge */}
      {match.status === "open" && isCreator ? (
        <Card className="border-red-400/20 p-4">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-2">
              <Trash2 size={17} className="text-red-400" />
            </div>

            <div>
              <h2 className="font-bold">Remove challenge post</h2>

              <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                Deleting this open post refunds your locked challenge tokens.
              </p>
            </div>
          </div>

          <ActionForm
            action={deleteMatchAction}
            submitLabel="Delete challenge post"
            confirmMessage="Delete this challenge post? Your locked challenge tokens will be refunded."
          >
            <input type="hidden" name="matchId" value={id} />
          </ActionForm>
        </Card>
      ) : null}

      {/* Private Match Chat */}
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
        <Card className="border-white/10 p-4">
          <div className="mb-3">
            <h2 className="font-bold  text-amber-400">Private Match chat</h2>

            <p className="mt-1 break-words text-sm text-[var(--accent-2)]">
              {playerLabel(creator)} vs {playerLabel(opponent)}
            </p>
          </div>

          <MatchChat matchId={id} currentUserId={session.user.id} />
        </Card>
      ) : null}
    </div>
  );
}

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
import { ShieldCheck, Swords } from "lucide-react";

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
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 pb-2">
      <Card className="relative overflow-hidden border-white/15 bg-transparent p-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/cs.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070a10]/95 via-[#070a10]/82 to-[#070a10]/50" />
        <div className="relative p-5 text-white sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-[var(--accent-2)]">
            <Swords size={17} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">
              Clash arena
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-black tracking-tight">
              {match.format}v{match.format}
            </h1>
            <Badge className="border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15">
              {match.status}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/70">{match.rules}</p>
          <p className="mt-3 break-words text-sm">
            {match.stakeMin === match.stakeMax
              ? `Match registration: ${match.stakeMin} NV Tokens each`
              : `Match registration range: ${match.stakeMin}–${match.stakeMax} NV Tokens each`}{" "}
            <span className="hidden sm:inline">•</span>
            <span className="block sm:inline">
              {" "}
              Creator: {isCreator ? "You" : match.creatorIgn}
            </span>
          </p>
          {match.acceptedStake ? (
            <p className="mt-2 text-sm">
              Registered with {match.acceptedStake} NV Tokens each • Final
              result verification determines eligible esports rewards.
            </p>
          ) : null}
        </div>
      </Card>
      <Card className="border-white/10">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[var(--accent-2)]" />
          <h2 className="font-bold">Match rules</h2>
        </div>
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li className="flex items-start gap-3">
            <span className="mt-1 text-[var(--primary)]">✓</span>
            <span>
              Use only the agreed-upon custom-room settings and follow all
              tournament rules.
            </span>
          </li>

          <li className="flex items-start gap-3">
            <span className="mt-1 text-[var(--primary)]">✓</span>
            <span>
              After the match ends, both players must upload a screenshot of the
              final result.
            </span>
          </li>
        </ul>
      </Card>
      {match.status === "open" && !isCreator ? (
        <Card>
          <h2 className="mb-1 font-bold">Accept challenge</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Your selected match registration is reserved as soon as you accept.
          </p>
          <ActionForm
            action={acceptMatchAction}
            submitLabel="Register for match"
          >
            <input type="hidden" name="matchId" value={id} />
            <div>
              <Label htmlFor="stake">Your match registration (NV Tokens)</Label>
              <Input
                id="stake"
                name="stake"
                type="number"
                min={match.stakeMin}
                max={match.stakeMax}
                step="0.01"
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

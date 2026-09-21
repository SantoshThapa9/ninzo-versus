import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMatchForUser } from "@/services/match.service";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { acceptMatchAction } from "@/app/actions/match";
import { EvidenceUpload } from "@/components/match/evidence-upload";
import { UserRole } from "@/types/enums";

export default async function ClashDetailPage({ params }: PageProps<"/clash/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const data = await getMatchForUser(session.user.id, id, session.user.role === UserRole.ADMIN);
  const match = data.match as {
    _id: string;
    format: number;
    status: string;
    stakeMin: number;
    stakeMax: number;
    acceptedStake?: number;
    rules: string;
    creatorIgn: string;
    platformFeePercent: number;
    winnerPayout?: number;
    prizePool?: number;
  };

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {match.format}v{match.format}
          </h1>
          <Badge>{match.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{match.rules}</p>
        <p className="mt-3 text-sm">
          Range {match.stakeMin}–{match.stakeMax} NV • Creator IGN {match.creatorIgn}
        </p>
        {match.acceptedStake ? (
          <p className="mt-2 text-sm">
            Final stake {match.acceptedStake} NV each • Pool {match.prizePool} • Winner{" "}
            {match.winnerPayout} ({match.platformFeePercent}% platform)
          </p>
        ) : null}
      </Card>
      <Card>
        <p className="text-sm text-[var(--danger)]">{data.settings.clashWarning}</p>
      </Card>
      {match.status === "open" ? (
        <Card>
          <h2 className="mb-3 font-bold">Accept challenge</h2>
          <ActionForm action={acceptMatchAction} submitLabel="Lock accepted stake">
            <input type="hidden" name="matchId" value={id} />
            <div>
              <Label htmlFor="stake">Your stake (NV)</Label>
              <Input id="stake" name="stake" type="number" min={match.stakeMin} max={match.stakeMax} required />
            </div>
            <div>
              <Label htmlFor="ign">Your IGN</Label>
              <Input id="ign" name="ign" required />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="warning" required className="mt-1" />
              I will type start in the custom room and screenshot it.
            </label>
          </ActionForm>
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 font-bold">Evidence</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Pre-match START and post-match result can be uploaded after the match. AI assists; admin confirms.
        </p>
        <EvidenceUpload matchId={id} />
      </Card>
    </div>
  );
}

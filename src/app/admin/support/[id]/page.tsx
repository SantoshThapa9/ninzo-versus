import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { getTicket } from "@/services/support.service";
import { getCurrentUserIdentity } from "@/services/player-profile.service";
import { listPreviousMatchesForUser } from "@/services/match.service";
import { userRepository } from "@/repositories/user.repository";
import { matchRepository } from "@/repositories/match.repository";
import { resultRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { resolveTicketAction } from "@/app/actions/support";
import { SupportTicketChat } from "@/components/support/support-ticket-chat";
import { SupportImageUploadToggle } from "@/components/support/support-image-upload-toggle";

function formatDateTime(value?: string | Date) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AdminSupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");

  const { id } = await params;
  const { ticket } = await getTicket(session.user.id, id, true);
  const reporterId = String(ticket.userId);
  const [reporter, identity, previousMatches] = await Promise.all([
    userRepository.findById(reporterId).lean(),
    getCurrentUserIdentity(reporterId),
    listPreviousMatchesForUser(reporterId),
  ]);
  const recentMatches = await Promise.all(previousMatches.slice(0, 2).map(async (match) => ({
    match,
    participants: await matchRepository.listParticipants(String(match._id)),
    evidence: await resultRepository.listForMatch(String(match._id)),
  })));

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold">Support request</h1>
          <Badge>{ticket.status}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm">
          <div><dt className="text-[var(--muted)]">Category</dt><dd>{ticket.category}</dd></div>
          <div><dt className="text-[var(--muted)]">WhatsApp</dt><dd>{ticket.whatsappNumber || "Not provided"}</dd></div>
          <div><dt className="text-[var(--muted)]">Report</dt><dd className="whitespace-pre-wrap">{ticket.summary}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-base font-semibold">Reporter details</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--muted)]">Name</dt><dd>{reporter?.displayName ?? "Unknown user"}</dd></div>
          <div><dt className="text-[var(--muted)]">Account ID</dt><dd className="break-all font-mono text-xs">{reporterId}</dd></div>
          <div><dt className="text-[var(--muted)]">In-game name</dt><dd>{identity.ign || "Not provided"}</dd></div>
          <div><dt className="text-[var(--muted)]">Free Fire UID</dt><dd>{identity.uid || "Not provided"}</dd></div>
        </dl>
      </Card>
      <section className="grid gap-2" aria-label="Recent game history">
        <h2 className="text-base font-semibold">Previous games</h2>
        {recentMatches.length ? (
          recentMatches.map(({ match, participants, evidence }) => {
            const isCreator = String(match.creatorId) === reporterId;
            const opponentIgn = isCreator ? match.opponentIgn : match.creatorIgn;
            const reporterResult =
              !match.winnerTeam
                ? "No winner recorded"
                : (match.winnerTeam === "A") === isCreator
                  ? "Won"
                  : "Lost";

            return (
              <Card key={String(match._id)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{match.format}v{match.format} against {opponentIgn}</p>
                  <Badge>{reporterResult}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {match.status} · {formatDateTime(match.completedAt ?? match.createdAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Players: {participants.map((player) => player.ign).join(", ") || "Not available"}
                </p>
                {evidence.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {evidence.map((item) => {
                      const imageUrl = `/api/clash/${String(match._id)}/evidence/${String(item._id)}`;
                      return <a key={String(item._id)} href={imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-white/10"><img src={imageUrl} alt="Match result screenshot" className="aspect-video w-full object-cover" /></a>;
                    })}
                  </div>
                ) : <p className="mt-2 text-xs text-[var(--muted)]">No result screenshots were submitted.</p>}
              </Card>
            );
          })
        ) : (
          <Card>
            <p className="text-sm text-[var(--muted)]">No previous games are available.</p>
          </Card>
        )}
      </section>
      <SupportImageUploadToggle
        ticketId={id}
        initiallyEnabled={Boolean(ticket.allowUserImageUploads)}
      />
      <SupportTicketChat ticketId={id} isAdmin />
      <Card>
        {ticket.status === "resolved" ? (
          <p className="text-sm text-[var(--muted)]">This support request is closed.</p>
        ) : (
          <form action={resolveTicketAction}>
              <input type="hidden" name="ticketId" value={id} />
              <PendingSubmitButton type="submit" variant="secondary" size="full" pendingLabel="Closing chat...">Close chat and mark solved</PendingSubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}

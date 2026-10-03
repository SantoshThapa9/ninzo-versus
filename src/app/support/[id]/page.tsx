import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTicket } from "@/services/support.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupportUpload } from "@/components/support/support-upload";
import { SupportTicketChat } from "@/components/support/support-ticket-chat";
import { UserRole } from "@/types/enums";

export default async function TicketPage({ params }: PageProps<"/support/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const { ticket } = await getTicket(
    session.user.id,
    id,
    session.user.role === UserRole.ADMIN,
  );

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{ticket.summary}</h1>
          <Badge>{ticket.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{ticket.category}</p>
      </Card>
      <SupportTicketChat ticketId={id} isAdmin={false} />
      <Card>
        {ticket.status === "resolved" ? (
          <p className="text-sm text-[var(--muted)]">This support request has been closed.</p>
        ) : !ticket.allowUserImageUploads ? (
          <p className="text-sm text-[var(--muted)]">
            Screenshot uploads are available when support enables them for this request.
          </p>
        ) : (
          <SupportUpload ticketId={id} />
        )}
      </Card>
    </div>
  );
}

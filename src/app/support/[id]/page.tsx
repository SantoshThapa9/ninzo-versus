import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTicket } from "@/services/support.service";
import { ActionForm } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sendMessageAction } from "@/app/actions/support";
import { SupportUpload } from "@/components/support/support-upload";
import { UserRole } from "@/types/enums";

export default async function TicketPage({ params }: PageProps<"/support/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const { ticket, messages } = await getTicket(
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
      <div className="grid gap-2">
        {messages.map((message) => (
          <Card key={String(message._id)}>
            <p className="text-xs uppercase text-[var(--accent-2)]">{message.sender}</p>
            <p className="mt-1 text-sm">{message.body}</p>
          </Card>
        ))}
      </div>
      <Card>
        <ActionForm action={sendMessageAction} submitLabel="Send">
          <input type="hidden" name="ticketId" value={id} />
          {session.user.role === UserRole.ADMIN ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="asAdmin" /> Reply as admin
            </label>
          ) : null}
          <Textarea name="body" required placeholder="Add details, IDs, or questions" />
        </ActionForm>
        <SupportUpload ticketId={id} />
      </Card>
    </div>
  );
}

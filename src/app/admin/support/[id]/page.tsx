import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { getTicket } from "@/services/support.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");

  const { id } = await params;
  const { ticket } = await getTicket(session.user.id, id, true);

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
    </div>
  );
}

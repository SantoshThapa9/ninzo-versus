import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { supportRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveTicketAction } from "@/app/actions/support";

export default async function AdminSupportPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  await connectDb();
  const tickets = await supportRepository.listAdmin();

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Support queue</h1>
      {tickets.map((ticket) => (
        <Card key={String(ticket._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/admin/support/${String(ticket._id)}`} className="font-bold">
              {ticket.summary}
            </Link>
            <Badge>{ticket.status}</Badge>
          </div>
          <p className="text-xs text-[var(--muted)]">{ticket.category}</p>
          <form action={resolveTicketAction} className="mt-2">
            <input type="hidden" name="ticketId" value={String(ticket._id)} />
            <Button type="submit" size="sm" variant="secondary">
              Resolve
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}

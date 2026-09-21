import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db/mongoose";
import { supportRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const tickets = await supportRepository.listForUser(session.user.id);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support</h1>
        <Button asChild size="sm">
          <Link href="/support/new">New ticket</Link>
        </Button>
      </div>
      {tickets.map((ticket) => (
        <Link key={String(ticket._id)} href={`/support/${String(ticket._id)}`}>
          <Card>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{ticket.summary}</p>
              <Badge>{ticket.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{ticket.category}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { eventRepository } from "@/repositories/event.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminEventsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  await connectDb();
  const events = await eventRepository.listAll();

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Button asChild size="sm">
          <Link href="/admin/events/new">Builder</Link>
        </Button>
      </div>
      {events.map((event) => (
        <Card key={String(event._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/admin/events/${String(event._id)}`} className="font-bold">
              {event.name}
            </Link>
            <Badge>{event.status}</Badge>
          </div>
          <div className="mt-3">
            <Button asChild size="sm">
              <Link href={`/admin/events/${String(event._id)}`}>Manage event</Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

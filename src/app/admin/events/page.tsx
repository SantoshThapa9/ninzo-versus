import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, EventStatus } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { eventRepository } from "@/repositories/event.repository";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventStatusAction } from "@/app/actions/event";

export default async function AdminEventsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
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
          <form action={eventStatusAction} className="mt-3 flex gap-2">
            <input type="hidden" name="eventId" value={String(event._id)} />
            <select name="status" className="h-11 flex-1 rounded-xl border border-white/10 bg-black/30 px-3">
              {Object.values(EventStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Update
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}

import Link from "next/link";
import { listPublicEvents } from "@/services/event.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function EventsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const events = await listPublicEvents();
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Competitive esports tournaments</h1>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
      ) : (
        events.map((event) => (
          <Link key={String(event._id)} href={`/events/${String(event._id)}`}>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{event.name}</h2>
                <Badge>{event.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {new Date(event.eventDate).toLocaleDateString("en-IN")} • {event.format} •{" "}
                Match registration: {event.entryFeeCoins} NV Tokens
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Current prize pool: {event.reservedSlots * event.entryFeeCoins} NV Tokens
              </p>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

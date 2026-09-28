import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEventDetail } from "@/services/event.service";
import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registerEventAction } from "@/app/actions/event";
import { UserRole } from "@/types/enums";

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const isAdmin = session.user.role === UserRole.ADMIN;
  const { event } = await getEventDetail(id, isAdmin);
  const canPay =
    event.status === "published" || event.status === "registration_open";
  const prizePool = event.reservedSlots * event.entryFeeCoins;
  const prizeFor = (percent: number) => Math.floor((prizePool * percent) / 100);

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <Badge>{event.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {new Date(event.eventDate).toLocaleDateString("en-IN")} • {event.startTime} • {event.format}
        </p>
        <p className="mt-2 text-sm">
          Match registration: {event.entryFeeCoins} NV Tokens • Slots {event.reservedSlots}/{event.maxSlots}
        </p>
        <p className="mt-2 text-sm">
          Skill {event.characterSkill ? "On" : "Off"} • Unlimited gloo{" "}
          {event.unlimitedGlooWall ? "On" : "Off"}
        </p>
        {event.customNotes ? <p className="mt-2 text-sm text-[var(--muted)]">{event.customNotes}</p> : null}
        {event.roomId || event.roomPassword ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
            <h2 className="font-bold">Room details</h2>
            {event.roomId ? <p className="mt-1">Room ID: {event.roomId}</p> : null}
            {event.roomPassword ? <p>Room password: {event.roomPassword}</p> : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-1 text-sm">
          <p>Current prize pool: {prizePool} NV Tokens ({event.reservedSlots} registrations × {event.entryFeeCoins} NV Tokens)</p>
          <p>1st: {prizeFor(event.prizeDistribution.first)} (50%) • 2nd: {prizeFor(event.prizeDistribution.second)} (30%) • 3rd: {prizeFor(event.prizeDistribution.third)} (10%) • Platform: {prizePool - prizeFor(event.prizeDistribution.first) - prizeFor(event.prizeDistribution.second) - prizeFor(event.prizeDistribution.third)} (10%)</p>
        </div>
      </Card>
      {canPay ? (
        <Card>
          <h2 className="mb-1 font-bold">Register for event</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">Your saved In Game Name from Profile will be used automatically.</p>
          <ActionForm action={registerEventAction} submitLabel="Confirm registration">
            <input type="hidden" name="eventId" value={id} />
          </ActionForm>
        </Card>
      ) : (
        <p className="text-sm text-[var(--muted)]">Registration is not open for this event.</p>
      )}
    </div>
  );
}

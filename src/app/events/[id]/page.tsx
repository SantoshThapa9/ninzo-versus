import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEventDetail } from "@/services/event.service";
import { IGN_COUNTS } from "@/config/defaults";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registerEventAction } from "@/app/actions/event";
import { EventFormat, UserRole } from "@/types/enums";

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const isAdmin = session.user.role === UserRole.ADMIN;
  const { event } = await getEventDetail(id, isAdmin);
  const format = event.format as EventFormat;
  const ignCount = IGN_COUNTS[format];
  const canPay =
    event.status === "published" || event.status === "registration_open";

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <Badge>{event.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {new Date(event.eventDate).toLocaleString("en-IN")} • {event.startTime} • {event.format}
        </p>
        <p className="mt-2 text-sm">
          Entry {event.entryFeeCoins} NV • Slots {event.reservedSlots}/{event.maxSlots}
        </p>
        <p className="mt-2 text-sm">
          Skill {event.characterSkill ? "On" : "Off"} • Unlimited gloo{" "}
          {event.unlimitedGlooWall ? "On" : "Off"}
        </p>
        {event.roomRules ? <p className="mt-3 text-sm">{event.roomRules}</p> : null}
        {event.customNotes ? <p className="mt-2 text-sm text-[var(--muted)]">{event.customNotes}</p> : null}
        <div className="mt-4 grid gap-1 text-sm">
          <p>Platform profit: {event.prizeDistribution.platformProfit} NV</p>
          <p>1st {event.prizeDistribution.first} • 2nd {event.prizeDistribution.second} • 3rd {event.prizeDistribution.third}</p>
        </div>
      </Card>
      {canPay ? (
        <Card>
          <h2 className="mb-3 font-bold">Register • {ignCount} In Game Name{ignCount > 1 ? "s" : ""}</h2>
          <ActionForm action={registerEventAction} submitLabel="Validate, pay, confirm slot">
            <input type="hidden" name="eventId" value={id} />
            <div>
              <Label htmlFor="igns">In Game Names (comma separated)</Label>
              <Input id="igns" name="igns" placeholder="Name1, Name2" required />
            </div>
          </ActionForm>
        </Card>
      ) : (
        <p className="text-sm text-[var(--muted)]">Registration is not open for this event.</p>
      )}
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, EventStatus } from "@/types/enums";
import { getEventDetail } from "@/services/event.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EventBuilderForm } from "@/components/admin/event-builder-form";
import { eventRoomAction, eventStatusAction, payPrizesAction, updateEventNoteAction } from "@/app/actions/event";

const workflowStatuses = [EventStatus.PUBLISHED, EventStatus.LIVE, EventStatus.CANCELLED];

export default async function AdminEventDetailPage({ params }: PageProps<"/admin/events/[id]">) {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  const { id } = await params;
  const { event, teams } = await getEventDetail(id, true);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <Badge>{event.status}</Badge>
      </div>
      <Card>
        <h2 className="mb-3 font-bold">Player custom note</h2>
        <form action={updateEventNoteAction} className="grid gap-2">
          <input type="hidden" name="eventId" value={id} />
          <Label htmlFor="eventCustomNotes">Note shown to players</Label>
          <textarea id="eventCustomNotes" name="customNotes" defaultValue={event.customNotes ?? ""} className="min-h-24 rounded-xl border border-white/10 bg-black/30 p-3" />
          <PendingSubmitButton type="submit" size="sm" pendingLabel="Saving note...">Save player note</PendingSubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Workflow</h2>
        <form action={eventStatusAction} className="flex gap-2">
          <input type="hidden" name="eventId" value={id} />
          <select name="status" defaultValue={event.status} className="h-11 flex-1 rounded-xl border border-white/10 bg-black/30 px-3">
            {workflowStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <PendingSubmitButton type="submit" pendingLabel="Updating...">Set status</PendingSubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Room settings</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">Saving both fields makes the event live, closes registration, and shares the details with all signed-in users.</p>
        <form action={eventRoomAction} className="grid gap-2">
          <input type="hidden" name="eventId" value={id} />
          <Label htmlFor="roomId">Room ID</Label>
          <Input id="roomId" name="roomId" defaultValue={event.roomId ?? ""} />
          <Label htmlFor="roomPassword">Password</Label>
          <Input id="roomPassword" name="roomPassword" defaultValue={event.roomPassword ?? ""} />
          <PendingSubmitButton type="submit" size="sm" pendingLabel="Saving room...">
            Save room
          </PendingSubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Registrations ({teams.length}/{event.maxSlots})</h2>
        {teams.map((team) => (
          <p key={String(team._id)} className="text-sm">
            Slot {team.slotNumber}: {team.igns.join(", ")} • {team.paidCoins} NV
          </p>
        ))}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Esports reward fulfillment (admin only)</h2>
        <form action={payPrizesAction} className="grid gap-2">
          <input type="hidden" name="eventId" value={id} />
          {[1, 2, 3].map((place) => (
            <div key={place}>
              <Label htmlFor={`place${place}`}>{place}st team id</Label>
              <select id={`place${place}`} name={`place${place}`} className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3">
                <option value="">None</option>
                {teams.map((team) => (
                  <option key={String(team._id)} value={String(team._id)}>
                    Slot {team.slotNumber} • {team.igns[0]}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <PendingSubmitButton type="submit" pendingLabel="Paying prizes...">Pay prizes & complete</PendingSubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Edit fields</h2>
        <EventBuilderForm
          event={{
            id,
            name: event.name,
            eventDate: event.eventDate,
            startTime: event.startTime,
            format: event.format,
            maxSlots: event.maxSlots,
            entryFeeCoins: event.entryFeeCoins,
            winningPrizeCoins: event.winningPrizeCoins,
            prizeDistribution: event.prizeDistribution,
            characterSkill: event.characterSkill,
            unlimitedGlooWall: event.unlimitedGlooWall,
            customNotes: event.customNotes,
          }}
        />
      </Card>
    </div>
  );
}

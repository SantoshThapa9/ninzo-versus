import { EventFormat, EventStatus } from "@/types/enums";
import { DEFAULT_PRIZE_SPLIT } from "@/config/defaults";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { saveEventAction } from "@/app/actions/event";

type EventValues = {
  id?: string;
  name?: string;
  eventDate?: string;
  startTime?: string;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  format?: string;
  maxSlots?: number;
  entryFeeCoins?: number;
  prizeDistribution?: {
    platformProfit: number;
    first: number;
    second: number;
    third: number;
  };
  characterSkill?: boolean;
  unlimitedGlooWall?: boolean;
  roomRules?: string;
  customNotes?: string;
};

function toLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventBuilderForm({ event }: { event?: EventValues }) {
  const prizes = event?.prizeDistribution ?? {
    platformProfit: DEFAULT_PRIZE_SPLIT.platformProfitPercent,
    first: DEFAULT_PRIZE_SPLIT.firstPercent,
    second: DEFAULT_PRIZE_SPLIT.secondPercent,
    third: DEFAULT_PRIZE_SPLIT.thirdPercent,
  };

  return (
    <ActionForm action={saveEventAction} submitLabel={event?.id ? "Update event" : "Save draft"}>
      {event?.id ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <div>
        <Label htmlFor="name">Event name</Label>
        <Input id="name" name="name" defaultValue={event?.name} required />
      </div>
      <div>
        <Label htmlFor="eventDate">Date</Label>
        <Input id="eventDate" name="eventDate" type="datetime-local" defaultValue={toLocal(event?.eventDate)} required />
      </div>
      <div>
        <Label htmlFor="startTime">Start time</Label>
        <Input id="startTime" name="startTime" defaultValue={event?.startTime ?? "21:00"} required />
      </div>
      <div>
        <Label htmlFor="registrationOpensAt">Registration opens</Label>
        <Input
          id="registrationOpensAt"
          name="registrationOpensAt"
          type="datetime-local"
          defaultValue={toLocal(event?.registrationOpensAt)}
          required
        />
      </div>
      <div>
        <Label htmlFor="registrationClosesAt">Registration closes</Label>
        <Input
          id="registrationClosesAt"
          name="registrationClosesAt"
          type="datetime-local"
          defaultValue={toLocal(event?.registrationClosesAt)}
          required
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-xs font-medium text-[var(--muted)]">Format</legend>
        {Object.values(EventFormat).map((format) => (
          <label key={format} className="flex items-center gap-2 text-sm">
            <input type="radio" name="format" value={format} defaultChecked={(event?.format ?? "solo") === format} />
            {format}
          </label>
        ))}
      </fieldset>
      <div>
        <Label htmlFor="maxSlots">Max teams / players</Label>
        <Input id="maxSlots" name="maxSlots" type="number" min={1} defaultValue={event?.maxSlots ?? 48} required />
      </div>
      <div>
        <Label htmlFor="entryFeeCoins">Entry fee (NV Coin)</Label>
        <Input id="entryFeeCoins" name="entryFeeCoins" type="number" min={0} defaultValue={event?.entryFeeCoins ?? 100} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="platformProfit">Platform profit</Label>
          <Input id="platformProfit" name="platformProfit" type="number" min={0} defaultValue={prizes.platformProfit} />
        </div>
        <div>
          <Label htmlFor="first">1st</Label>
          <Input id="first" name="first" type="number" min={0} defaultValue={prizes.first} />
        </div>
        <div>
          <Label htmlFor="second">2nd</Label>
          <Input id="second" name="second" type="number" min={0} defaultValue={prizes.second} />
        </div>
        <div>
          <Label htmlFor="third">3rd</Label>
          <Input id="third" name="third" type="number" min={0} defaultValue={prizes.third} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="characterSkill" defaultChecked={event?.characterSkill ?? true} />
        Character Skill On
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="unlimitedGlooWall" defaultChecked={event?.unlimitedGlooWall ?? false} />
        Unlimited Gloo Wall On
      </label>
      <div>
        <Label htmlFor="roomRules">Room rules</Label>
        <Textarea id="roomRules" name="roomRules" defaultValue={event?.roomRules} />
      </div>
      <div>
        <Label htmlFor="customNotes">Custom notes</Label>
        <Textarea id="customNotes" name="customNotes" defaultValue={event?.customNotes} />
      </div>
      <p className="text-xs text-[var(--muted)]">
        Status stays {EventStatus.DRAFT} until you publish. Unpublished events cannot take payments or slots.
      </p>
    </ActionForm>
  );
}

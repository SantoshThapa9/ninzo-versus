"use client";

import { useState } from "react";
import { EventFormat } from "@/types/enums";
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
  customNotes?: string;
};

function toDateInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function EventBuilderForm({ event }: { event?: EventValues }) {
  const [maxSlots, setMaxSlots] = useState(event?.maxSlots ?? 48);
  const [entryFeeCoins, setEntryFeeCoins] = useState(event?.entryFeeCoins ?? 10);
  const totalPool = Math.max(0, maxSlots) * Math.max(0, entryFeeCoins);
  const rewards = {
    first: Math.floor((totalPool * DEFAULT_PRIZE_SPLIT.firstPercent) / 100),
    second: Math.floor((totalPool * DEFAULT_PRIZE_SPLIT.secondPercent) / 100),
    third: Math.floor((totalPool * DEFAULT_PRIZE_SPLIT.thirdPercent) / 100),
    platform: totalPool - Math.floor((totalPool * 90) / 100),
  };

  return (
    <ActionForm action={saveEventAction} submitLabel={event?.id ? "Update event" : "Publish & open registration"}>
      {event?.id ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <div>
        <Label htmlFor="name">Event name</Label>
        <Input id="name" name="name" defaultValue={event?.name} required />
      </div>
      <div>
        <Label htmlFor="eventDate">Date</Label>
        <Input id="eventDate" name="eventDate" type="date" defaultValue={toDateInput(event?.eventDate)} required />
      </div>
      <div>
        <Label htmlFor="startTime">Match start time</Label>
        <Input id="startTime" name="startTime" type="time" defaultValue={event?.startTime ?? "21:00"} required />
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
        <Label htmlFor="maxSlots">Maximum registrations</Label>
        <Input id="maxSlots" name="maxSlots" type="number" min={1} value={maxSlots} onChange={(e) => setMaxSlots(Number(e.target.value))} required />
      </div>
      <div>
        <Label htmlFor="entryFeeCoins">Match registration (NV Tokens)</Label>
        <Input id="entryFeeCoins" name="entryFeeCoins" type="number" min={0} value={entryFeeCoins} onChange={(e) => setEntryFeeCoins(Number(e.target.value))} required />
      </div>
      <input type="hidden" name="platformProfit" value={DEFAULT_PRIZE_SPLIT.platformProfitPercent} />
      <input type="hidden" name="first" value={DEFAULT_PRIZE_SPLIT.firstPercent} />
      <input type="hidden" name="second" value={DEFAULT_PRIZE_SPLIT.secondPercent} />
      <input type="hidden" name="third" value={DEFAULT_PRIZE_SPLIT.thirdPercent} />
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
        <p className="font-medium">Projected prize pool at {maxSlots || 0} registrations: {totalPool} NV Tokens</p>
        <p className="mt-1 text-[var(--muted)]">1st: {rewards.first} (50%) • 2nd: {rewards.second} (30%) • 3rd: {rewards.third} (10%) • Platform: {rewards.platform} (10%)</p>
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
        <Label htmlFor="customNotes">Player note</Label>
        <Textarea id="customNotes" name="customNotes" defaultValue={event?.customNotes} />
      </div>
      <p className="text-xs text-[var(--muted)]">
        Saving a new event publishes it immediately. Registration closes automatically at match start time.
      </p>
    </ActionForm>
  );
}

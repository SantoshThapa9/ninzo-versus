"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { EventStatus } from "@/types/enums";
import {
  createEvent,
  payEventPrizes,
  registerForEvent,
  saveEventRoom,
  transitionEvent,
  updateEvent,
} from "@/services/event.service";

export async function saveEventAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireAdmin();
    const payload = {
      name: String(formData.get("name") ?? ""),
      eventDate: String(formData.get("eventDate") ?? ""),
      startTime: String(formData.get("startTime") ?? ""),
      registrationOpensAt: String(formData.get("registrationOpensAt") ?? ""),
      registrationClosesAt: String(formData.get("registrationClosesAt") ?? ""),
      format: String(formData.get("format") ?? "solo"),
      maxSlots: Number(formData.get("maxSlots")),
      entryFeeCoins: Number(formData.get("entryFeeCoins")),
      prizeDistribution: {
        platformProfit: Number(formData.get("platformProfit")),
        first: Number(formData.get("first")),
        second: Number(formData.get("second")),
        third: Number(formData.get("third")),
      },
      characterSkill: formData.get("characterSkill") === "on",
      unlimitedGlooWall: formData.get("unlimitedGlooWall") === "on",
      roomRules: String(formData.get("roomRules") ?? ""),
      customNotes: String(formData.get("customNotes") ?? ""),
    };
    const eventId = String(formData.get("eventId") ?? "");
    const event = eventId
      ? await updateEvent(session.user.id, eventId, payload)
      : await createEvent(session.user.id, payload);
    revalidatePath("/admin/events");
    redirect(`/admin/events/${String(event._id)}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function eventStatusAction(formData: FormData) {
  const session = await requireAdmin();
  await transitionEvent(
    session.user.id,
    String(formData.get("eventId") ?? ""),
    String(formData.get("status") ?? "") as EventStatus,
  );
  revalidatePath("/admin/events");
}

export async function eventRoomAction(formData: FormData) {
  const session = await requireAdmin();
  await saveEventRoom(
    session.user.id,
    String(formData.get("eventId") ?? ""),
    String(formData.get("roomId") ?? ""),
    String(formData.get("roomPassword") ?? ""),
  );
  revalidatePath("/admin/events");
}

export async function registerEventAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    const igns = String(formData.get("igns") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await registerForEvent(session.user.id, {
      eventId: String(formData.get("eventId") ?? ""),
      igns,
    });
    revalidatePath("/events");
    return { ok: true };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function payPrizesAction(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const placements = [1, 2, 3]
    .map((placement) => ({
      teamId: String(formData.get(`place${placement}`) ?? ""),
      placement: placement as 1 | 2 | 3,
    }))
    .filter((row) => row.teamId);
  await payEventPrizes(session.user.id, eventId, placements);
  revalidatePath("/admin/events");
}

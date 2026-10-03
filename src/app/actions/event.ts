"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { EventStatus } from "@/types/enums";
import { DEFAULT_PRIZE_SPLIT } from "@/config/defaults";
import {
  createEvent,
  payEventPrizes,
  registerForEvent,
  saveEventRoom,
  transitionEvent,
  updateEvent,
} from "@/services/event.service";

function invalidatePublicEvents() {
  updateTag("public-events");
}

export async function saveEventAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  try {
    const session = await requireAdmin();
    const payload = {
      name: String(formData.get("name") ?? ""),
      eventDate: String(formData.get("eventDate") ?? ""),
      startTime: String(formData.get("startTime") ?? ""),
      format: String(formData.get("format") ?? "solo"),
      maxSlots: Number(formData.get("maxSlots")),
      entryFeeCoins:
        formData.get("freeEntry") === "on"
          ? 0
          : Number(formData.get("entryFeeCoins")),
      winningPrizeCoins: Number(formData.get("winningPrizeCoins") ?? 0),
      prizeDistribution: {
        platformProfit: DEFAULT_PRIZE_SPLIT.platformProfitPercent,
        first: DEFAULT_PRIZE_SPLIT.firstPercent,
        second: DEFAULT_PRIZE_SPLIT.secondPercent,
        third: DEFAULT_PRIZE_SPLIT.thirdPercent,
      },
      characterSkill: formData.get("characterSkill") === "on",
      unlimitedGlooWall: formData.get("unlimitedGlooWall") === "on",
      customNotes: String(formData.get("customNotes") ?? ""),
    };
    const eventId = String(formData.get("eventId") ?? "");
    const event = eventId
      ? await updateEvent(session.user.id, eventId, payload)
      : await createEvent(session.user.id, payload);
    const savedEventId = String(event._id);

    invalidatePublicEvents();
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${savedEventId}`);
    revalidatePath("/matches");
    revalidatePath(`/events/${savedEventId}`);
    revalidatePath("/");
    redirect(`/admin/events/${savedEventId}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function updateEventNoteAction(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  await updateEvent(session.user.id, eventId, {
    customNotes: String(formData.get("customNotes") ?? ""),
  });
  invalidatePublicEvents();
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/matches");
  revalidatePath("/");
}

export async function eventStatusAction(formData: FormData) {
  const session = await requireAdmin();
  await transitionEvent(
    session.user.id,
    String(formData.get("eventId") ?? ""),
    String(formData.get("status") ?? "") as EventStatus,
  );
  invalidatePublicEvents();
  revalidatePath("/admin/events");
  revalidatePath("/matches");
  revalidatePath("/");
}

export async function eventRoomAction(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  await saveEventRoom(
    session.user.id,
    eventId,
    String(formData.get("roomId") ?? ""),
    String(formData.get("roomPassword") ?? ""),
  );
  invalidatePublicEvents();
  revalidatePath("/admin/events");
  revalidatePath("/matches");
  revalidatePath("/");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
}

export async function registerEventAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    const eventId = String(formData.get("eventId") ?? "");
    await registerForEvent(session.user.id, {
      eventId,
    });
    invalidatePublicEvents();
    revalidatePath("/matches");
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/");
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
  invalidatePublicEvents();
  revalidatePath("/admin/events");
  revalidatePath("/rank");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { openTicket, sendTicketMessage } from "@/services/support.service";
import { ReportType, SupportStatus } from "@/types/enums";
import { SupportTicketModel } from "@/models/support-ticket";
import { connectDb } from "@/lib/db/mongoose";

export async function createTicketAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    const ticket = await openTicket(session.user.id, {
      category: String(formData.get("category") ?? ReportType.MATCH_DISPUTE) as ReportType,
      summary: String(formData.get("summary") ?? ""),
      matchId: String(formData.get("matchId") ?? "") || undefined,
      whatsappNumber: String(formData.get("whatsappNumber") ?? "") || undefined,
      freeFireUid: String(formData.get("freeFireUid") ?? "") || undefined,
      ign: String(formData.get("ign") ?? "") || undefined,
    });
    revalidatePath("/support");
    redirect(`/support/${String(ticket._id)}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function sendMessageAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    const ticketId = String(formData.get("ticketId") ?? "");
    const body = String(formData.get("body") ?? "");
    const asAdmin = session.user.role === "admin" && formData.get("asAdmin") === "on";
    await sendTicketMessage(session.user.id, ticketId, body, asAdmin);
    revalidatePath(`/support/${ticketId}`);
    return { ok: true };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function resolveTicketAction(formData: FormData) {
  const session = await requireAdmin();
  await connectDb();
  await SupportTicketModel.findByIdAndUpdate(String(formData.get("ticketId") ?? ""), {
    status: SupportStatus.RESOLVED,
  });
  revalidatePath("/admin/support");
}

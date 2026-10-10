"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { openTicket, sendTicketMessage } from "@/services/support.service";
import { ReportType } from "@/types/enums";
import { SupportTicketModel } from "@/models/support-ticket";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { SupportMessageModel } from "@/models/support-message";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { deletePrivateMedia } from "@/services/media.service";
import { disputeRepository } from "@/repositories/ops.repository";

export async function createTicketAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    const ticket = await openTicket(session.user.id, {
      category: String(formData.get("category") ?? ReportType.MATCH_DISPUTE) as ReportType,
      summary: String(formData.get("summary") ?? ""),
      matchId: String(formData.get("matchId") ?? "") || undefined,
      whatsappNumber: String(formData.get("whatsappNumber") ?? "") || undefined,
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
    revalidatePath(`/admin/support/${ticketId}`);
    revalidatePath("/admin/support");
    return { ok: true };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function deleteTicketAction(formData: FormData) {
  await requireAdmin();
  const ticketId = String(formData.get("ticketId") ?? "");
  await connectDb();
  const evidence = await SupportEvidenceModel.find({ ticketId })
    .select("blobPathname")
    .lean();
  for (const item of evidence) {
    await deletePrivateMedia(item.blobPathname);
    await SupportEvidenceModel.deleteOne({ _id: item._id });
  }
  await withTransaction(async (session) => {
    await SupportMessageModel.deleteMany({ ticketId }).session(session);
    await disputeRepository.deleteForTicket(ticketId, session);
    await SupportTicketModel.deleteOne({ _id: ticketId }).session(session);
  });
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
  redirect("/admin/support");
}

import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { supportRepository, disputeRepository } from "@/repositories/ops.repository";
import { supportAiReply } from "@/services/ai.service";
import { ReportType, SupportStatus, TicketSender } from "@/types/enums";

const reportTypes = Object.values(ReportType) as [ReportType, ...ReportType[]];

const createSchema = z.object({
  category: z.enum(reportTypes),
  summary: z.string().min(8),
  matchId: z.string().optional(),
  whatsappNumber: z.string().min(6).optional(),
  freeFireUid: z.string().optional(),
  ign: z.string().optional(),
});

export async function openTicket(userId: string, raw: unknown) {
  const input = createSchema.parse(raw);
  await connectDb();
  const ticket = await supportRepository.createTicket({ userId, ...input });
  await supportRepository.addMessage({
    ticketId: String(ticket._id),
    sender: TicketSender.USER,
    senderId: userId,
    body: input.summary,
  });

  const missing: string[] = [];
  if (!input.whatsappNumber) missing.push("WhatsApp number");
  if (!input.freeFireUid) missing.push("Free Fire UID");
  if (!input.ign) missing.push("In Game Name");
  missing.push("Screenshots");
  missing.push("Video (recommended)");

  const ai = await supportAiReply({
    summary: input.summary,
    category: input.category,
    history: [{ sender: "user", body: input.summary }],
    missing,
  });

  await supportRepository.addMessage({
    ticketId: String(ticket._id),
    sender: TicketSender.AI,
    body: ai.reply,
  });

  if (ai.escalate) {
    ticket.status = SupportStatus.PENDING_ADMIN;
    await ticket.save();
  }

  if (input.category === ReportType.MATCH_DISPUTE) {
    await disputeRepository.create({
      matchId: input.matchId,
      reporterId: userId,
      type: input.category,
      freeFireUid: input.freeFireUid,
      ign: input.ign,
      description: input.summary,
      ticketId: ticket._id,
    });
  }

  return ticket;
}

export async function sendTicketMessage(userId: string, ticketId: string, body: string, asAdmin = false) {
  await connectDb();
  const ticket = await supportRepository.findTicket(ticketId);
  if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
  if (!asAdmin && String(ticket.userId) !== userId) {
    throw new AppError("Forbidden.", "FORBIDDEN", 403);
  }

  await supportRepository.addMessage({
    ticketId,
    sender: asAdmin ? TicketSender.ADMIN : TicketSender.USER,
    senderId: userId,
    body,
  });

  if (asAdmin) {
    ticket.status = SupportStatus.ADMIN_ACTIVE;
    await ticket.save();
    return;
  }

  const history = await supportRepository.listMessages(ticketId);
  const ai = await supportAiReply({
    summary: ticket.summary,
    category: ticket.category as ReportType,
    history: history.map((m) => ({ sender: m.sender, body: m.body })),
  });
  await supportRepository.addMessage({
    ticketId,
    sender: TicketSender.AI,
    body: ai.reply,
  });
  if (ai.escalate) {
    ticket.status = SupportStatus.PENDING_ADMIN;
    await ticket.save();
  }
}

export async function getTicket(userId: string, ticketId: string, isAdmin: boolean) {
  await connectDb();
  const ticket = await supportRepository.findTicket(ticketId);
  if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
  if (!isAdmin && String(ticket.userId) !== userId) {
    throw new AppError("Forbidden.", "FORBIDDEN", 403);
  }
  const messages = await supportRepository.listMessages(ticketId);
  return { ticket: JSON.parse(JSON.stringify(ticket)), messages };
}

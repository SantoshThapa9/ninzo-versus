import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import {
  supportRepository,
  disputeRepository,
} from "@/repositories/ops.repository";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { ReportType, SupportStatus, TicketSender } from "@/types/enums";
import { notifySupportAdminReply } from "@/services/push-notification.service";

const reportTypes = Object.values(ReportType) as [ReportType, ...ReportType[]];

const createSchema = z.object({
  category: z.enum(reportTypes),
  summary: z.string().min(8),
  matchId: z.string().optional(),
  whatsappNumber: z.string().min(6).optional(),
});

export async function openTicket(userId: string, raw: unknown) {
  const input = createSchema.parse(raw);
  await connectDb();
  const profile = await playerProfileRepository.findByUserId(userId);
  const ticket = await supportRepository.createTicket({
    userId,
    source: "manual",
    ...input,
    ign: profile?.ign,
  });
  await supportRepository.addMessage({
    ticketId: String(ticket._id),
    sender: TicketSender.USER,
    senderId: userId,
    body: input.summary,
  });
  ticket.status = SupportStatus.PENDING_ADMIN;
  await ticket.save();

  if (input.category === ReportType.MATCH_DISPUTE) {
    await disputeRepository.create({
      matchId: input.matchId,
      reporterId: userId,
      type: input.category,
      ign: profile?.ign,
      description: input.summary,
      ticketId: ticket._id,
    });
  }

  return ticket;
}

export async function sendTicketMessage(
  userId: string,
  ticketId: string,
  body: string,
  asAdmin = false,
) {
  await connectDb();
  const ticket = await supportRepository.findTicket(ticketId);
  if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
  if (ticket.status === SupportStatus.RESOLVED) {
    throw new AppError(
      "This support request has been closed.",
      "TICKET_CLOSED",
      409,
    );
  }
  if (!asAdmin && String(ticket.userId) !== userId) {
    throw new AppError("Forbidden.", "FORBIDDEN", 403);
  }

  const message = await supportRepository.addMessage({
    ticketId,
    sender: asAdmin ? TicketSender.ADMIN : TicketSender.USER,
    senderId: userId,
    body,
  });

  if (asAdmin) {
    ticket.status = SupportStatus.ADMIN_ACTIVE;
    await ticket.save();
    // A reply is saved even if a browser's push subscription has expired.
    void notifySupportAdminReply(String(ticket.userId), ticketId, body).catch(
      (error) =>
        console.error("[push] Failed to queue support reply notification.", {
          ticketId,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
  }
  return message;
}

export async function getTicket(
  userId: string,
  ticketId: string,
  isAdmin: boolean,
) {
  await connectDb();
  const ticket = await supportRepository.findTicket(ticketId);
  if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
  if (!isAdmin && String(ticket.userId) !== userId) {
    throw new AppError("Forbidden.", "FORBIDDEN", 403);
  }
  const [messages, evidence] = await Promise.all([
    supportRepository.listMessages(ticketId),
    supportRepository.listEvidence(ticketId),
  ]);
  return { ticket: JSON.parse(JSON.stringify(ticket)), messages, evidence };
}

export async function getSupportChat(
  userId: string,
  ticketId: string,
  isAdmin: boolean,
) {
  const { ticket, messages, evidence } = await getTicket(
    userId,
    ticketId,
    isAdmin,
  );
  return {
    status: ticket.status,
    messages: JSON.parse(JSON.stringify(messages)),
    evidence: evidence.map((item) => ({
      _id: String(item._id),
      imageUrl: `/api/support/${ticketId}/evidence/${String(item._id)}`,
    })),
  };
}

import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { SupportMessageModel } from "@/models/support-message";
import { SupportTicketModel } from "@/models/support-ticket";
import { TicketSender } from "@/types/enums";

/** Returns recent admin replies for the signed-in customer's support tickets. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDb();
  const tickets = await SupportTicketModel.find({
    userId: session.user.id,
    source: "manual",
  })
    .select("_id")
    .maxTimeMS(8_000)
    .lean();
  const ticketIds = tickets.map((ticket) => ticket._id);
  if (!ticketIds.length) return Response.json({ messages: [] });
  const messages = await SupportMessageModel.find({
    ticketId: { $in: ticketIds },
    sender: TicketSender.ADMIN,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .maxTimeMS(8_000)
    .lean();
  return Response.json({
    messages: messages.map((message) => ({
      id: String(message._id),
      ticketId: String(message.ticketId),
      body: message.body,
    })),
  });
}

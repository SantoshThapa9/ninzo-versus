import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { UserModel } from "@/models/user";
import { matchRepository } from "@/repositories/match.repository";

/** Returns recent incoming private-chat messages for the in-app notifier. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();
  const matches = await matchRepository.listActiveForUser(session.user.id);
  const mutedMatchIds = new Set(
    matches
      .filter((match) =>
        (match.chatNotificationMutedBy ?? []).some(
          (mutedUserId: unknown) => String(mutedUserId) === session.user.id,
        ),
      )
      .map((match) => String(match._id)),
  );
  const matchIds = matches
    .map((match) => String(match._id))
    .filter((matchId) => !mutedMatchIds.has(matchId));
  if (!matchIds.length) return Response.json({ messages: [] });

  const messages = await MatchChatMessageModel.find({
    matchId: { $in: matchIds },
    senderId: { $ne: session.user.id },
    senderOnly: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const senderIds = [...new Set(messages.map((message) => String(message.senderId)))];
  const users = await UserModel.find({ _id: { $in: senderIds } })
    .select("ign")
    .lean();
  const ignByUserId = new Map(
    users.map((user) => [String(user._id), user.ign || "Opponent"]),
  );

  return Response.json({
    messages: messages.map((message) => ({
      id: String(message._id),
      matchId: String(message.matchId),
      senderName: ignByUserId.get(String(message.senderId)) ?? "Opponent",
      body: message.body,
      createdAt: message.createdAt,
    })),
  });
}

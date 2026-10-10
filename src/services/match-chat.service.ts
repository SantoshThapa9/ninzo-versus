import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { CLASH_CHAT_EXPIRY_MS } from "@/config/defaults";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { UserModel } from "@/models/user";
import { matchRepository } from "@/repositories/match.repository";
import {
  resultRepository,
} from "@/repositories/ops.repository";
import {
  expireMatchAfterChatTimeout,
  expireMatchEvidenceDeadline,
  finalizeMatchEvidence,
} from "@/services/match.service";
import {
  getMatchEvidenceDeadline,
  parseScreenshotResult,
} from "@/services/match-evidence-rules";
import { isSenderOnlyChatMessage, publicChatBody } from "@/lib/chat-moderation";

const messageSchema = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(1000);

// function normalizeRoomId(value?: string) {
//   const raw = value?.trim() ?? "";
//   const normalized = raw.toLocaleUpperCase().replace(/[^A-Z0-9#]/g, "");
//   const hashIndex = normalized.indexOf("#");
//   if (hashIndex === -1) return normalized.replace(/[^0-9]/g, "").slice(-7);
//   const beforeHash = normalized.slice(0, hashIndex);
//   const digits = beforeHash.replace(/[^0-9]/g, "");
//   return digits.slice(-7) || normalized.slice(-7);
// }

async function getParticipantMatch(userId: string, matchId: string) {
  const match = await matchRepository.findById(matchId);
  if (!match || !match.opponentCaptainId)
    throw new AppError(
      "Chat opens after a challenge is accepted.",
      "CHAT_UNAVAILABLE",
      404,
    );
  if (
    String(match.creatorId) !== userId &&
    String(match.opponentCaptainId) !== userId
  ) {
    throw new AppError(
      "Only match participants can use this chat.",
      "FORBIDDEN",
      403,
    );
  }
  return match;
}

function getChatExpiry(match: { chatExpiresAt?: Date; updatedAt: Date }) {
  // Matches accepted before chat expiry was added do not have chatExpiresAt.
  // Their updated time is the acceptance time unless an admin later changed the match.
  return (
    match.chatExpiresAt ??
    new Date(new Date(match.updatedAt).getTime() + CLASH_CHAT_EXPIRY_MS)
  );
}

async function assertChatOpen(userId: string, matchId: string) {
  let match = await getParticipantMatch(userId, matchId);
  // Starting a transaction for every sent message is expensive. It is only
  // needed after the deadline, when the match must be refunded and closed.
  if (
    (match.status === "accepted" || match.status === "live") &&
    getChatExpiry(match) <= new Date()
  ) {
    await expireMatchAfterChatTimeout(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  const deadlineAwardPending =
    match.status === "disputed" &&
    match.aiWinnerRecommendation?.startsWith(
      "Deadline expired: lone VICTORY",
    );
  if (
    deadlineAwardPending ||
    ((match.status === "awaiting_evidence" ||
      match.status === "analyzing") &&
      match.evidenceDeadlineAt &&
      match.evidenceDeadlineAt <= new Date())
  ) {
    await expireMatchEvidenceDeadline(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  if (match.status === "awaiting_evidence" || match.status === "analyzing") {
    await finalizeMatchEvidence(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  if (match.status === "awaiting_evidence" || match.status === "analyzing") {
    await finalizeMatchEvidence(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  if (match.status !== "accepted" && match.status !== "live") {
    throw new AppError(
      "Chat is closed while match screenshots are being submitted or reviewed.",
      "CHAT_CLOSED",
      410,
    );
  }
  if ((match.completedBy?.length ?? 0) > 0) {
    throw new AppError(
      "This match was marked complete, so chat is closed for both players.",
      "CHAT_CLOSED",
      410,
    );
  }
  const expiresAt = getChatExpiry(match);
  if (expiresAt <= new Date())
    throw new AppError(
      "This match chat expired after 12 hours.",
      "CHAT_EXPIRED",
      410,
    );
  return expiresAt;
}

export async function getMatchChat(
  userId: string,
  matchId: string,
  after?: { createdAt: Date; id: string },
) {
  await connectDb();
  let match = await getParticipantMatch(userId, matchId);
  // Normal chat polling stays read-only. Only the first request after expiry
  // performs the settlement transaction.
  if (
    (match.status === "accepted" || match.status === "live") &&
    getChatExpiry(match) <= new Date()
  ) {
    await expireMatchAfterChatTimeout(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  const deadlineAwardPending =
    match.status === "disputed" &&
    match.aiWinnerRecommendation?.startsWith("Deadline expired: lone VICTORY");
  if (
    deadlineAwardPending ||
    ((match.status === "awaiting_evidence" ||
      match.status === "analyzing") &&
      match.evidenceDeadlineAt &&
      match.evidenceDeadlineAt <= new Date())
  ) {
    await expireMatchEvidenceDeadline(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  const isEvidenceMode = [
    "awaiting_evidence",
    "analyzing",
    "result_review",
    "disputed",
    "settled",
  ].includes(match.status);
  const expiresAt = getChatExpiry(match);
  const messages = await MatchChatMessageModel.find({
    matchId,
    ...(after
      ? {
          createdAt: { $gte: after.createdAt },
          _id: { $ne: after.id },
        }
      : {}),
  })
    .sort({ createdAt: 1 })
    .maxTimeMS(8_000)
    .lean();
  const participantIds = [
    String(match.creatorId),
    String(match.opponentCaptainId),
  ];
  // `ign` is intentionally mirrored on User for hot paths such as chat. One
  // indexed lookup supplies both participant names, including an empty chat.
  const users = await UserModel.find({ _id: { $in: participantIds } })
    .select("ign")
    .lean();
  const nameBySenderId = new Map(
    users.map((user) => [String(user._id), user.ign || "Player"]),
  );
  const evidence = isEvidenceMode
    ? (await resultRepository.listForMatch(matchId)).filter(
        (item) => item.kind === "post_match_result",
      )
    : [];
  const myEvidence = evidence.find((item) => String(item.userId) === userId);
  const myAnalysis = myEvidence?.aiAnalysis as
    | {
        result?: "VICTORY" | "DEFEAT" | "UNREADABLE";
      }
    | undefined;
  const myAnalysisResult = myAnalysis
    ? parseScreenshotResult(myAnalysis.result)
    : undefined;
  const provisionalResult =
    myAnalysisResult === "VICTORY"
      ? "win"
      : myAnalysisResult === "DEFEAT"
        ? "loss"
        : myAnalysisResult === "UNREADABLE"
          ? "unreadable"
          : undefined;
  const deadlineOutcome = match.aiWinnerRecommendation?.startsWith(
    "Deadline expired:",
  )
    ? match.aiWinnerRecommendation
    : undefined;
  return {
    expiresAt,
    closed:
      isEvidenceMode ||
      match.status === "cancelled" ||
      (match.completedBy?.length ?? 0) > 0,
    matchStatus: match.status,
    // The fallback keeps the countdown available for matches completed while
    // the deadline field was not yet present on an older Mongo document.
    evidenceDeadlineAt: (match.evidenceDeadlineAt ??
      (match.completedAt
        ? getMatchEvidenceDeadline(new Date(match.completedAt))
        : undefined))?.toISOString(),
    deadlineOutcome,
    chatNotificationsMuted: (match.chatNotificationMutedBy ?? []).some(
      (mutedUserId: unknown) => String(mutedUserId) === userId,
    ),
    result:
      match.status === "settled"
        ? (match.winnerTeam === "A") === (String(match.creatorId) === userId)
          ? "win"
          : "loss"
        : match.status === "disputed"
          ? "hold"
          : provisionalResult,
    bothScreenshotsUploaded:
      evidence.some(
        (item) => String(item.userId) === String(match.creatorId),
      ) &&
      evidence.some(
        (item) => String(item.userId) === String(match.opponentCaptainId),
      ),
    evidence: isEvidenceMode
      ? evidence
          .filter((item) => String(item.userId) === userId)
          .map((item) => ({
            _id: String(item._id),
            userId: String(item.userId),
            kind: item.kind,
            // Private Blob URLs cannot be rendered by a browser. Keep the Blob URL
            // server-only and give authorized players an app URL instead.
            imageUrl: `/api/clash/${matchId}/evidence/${String(item._id)}`,
          }))
      : [],
    messages: JSON.parse(
      JSON.stringify(
        messages
          .filter((message) => {
            const senderId = String(message.senderId);
            if (senderId === userId) return true;
            return !isSenderOnlyChatMessage(
              message.body,
              Boolean(message.senderOnly),
            );
          })
          .map((message) => ({
            ...message,
            body: publicChatBody(message.body),
            senderName:
              nameBySenderId.get(String(message.senderId)) ?? "Player",
          })),
      ),
    ),
  };
}

export async function setMatchChatNotificationsMuted(
  userId: string,
  matchId: string,
  muted: boolean,
) {
  await connectDb();
  await getParticipantMatch(userId, matchId);
  const update = muted
    ? { $addToSet: { chatNotificationMutedBy: userId } }
    : { $pull: { chatNotificationMutedBy: userId } };
  await matchRepository.updateById(matchId, update);
  return { muted };
}

export async function sendMatchChatMessage(
  userId: string,
  matchId: string,
  rawBody: string,
) {
  const parsed = messageSchema.parse(rawBody);
  const senderOnly = isSenderOnlyChatMessage(parsed);
  const body = senderOnly ? publicChatBody(parsed) : parsed;
  await connectDb();
  const expiresAt = await assertChatOpen(userId, matchId);
  const message = await MatchChatMessageModel.create({
    matchId,
    senderId: userId,
    body,
    senderOnly,
    expiresAt,
  });
  const user = await UserModel.findById(userId).select("ign").lean();
  const match = await getParticipantMatch(userId, matchId);
  const recipientId =
    String(match.creatorId) === userId
      ? String(match.opponentCaptainId)
      : String(match.creatorId);
  const recipientHasMutedChat = (match.chatNotificationMutedBy ?? []).some(
    (mutedUserId: unknown) => String(mutedUserId) === recipientId,
  );
  const created = message.toObject();
  return {
    ...created,
    body: publicChatBody(created.body),
    senderName: user?.ign || "Player",
    recipientId,
    recipientHasMutedChat,
  };
}

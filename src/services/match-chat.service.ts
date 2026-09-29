import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { UserModel } from "@/models/user";
import { matchRepository } from "@/repositories/match.repository";
import {
  evidenceAttemptRepository,
  resultRepository,
} from "@/repositories/ops.repository";
import {
  expireMatchAfterChatTimeout,
  finalizeMatchEvidence,
} from "@/services/match.service";
import { getCurrentUserIdentity } from "@/services/player-profile.service";

const messageSchema = z
  .string()
  .trim()
  .min(1, "Write a message first.")
  .max(1000);

function normalizeIgn(value?: string) {
  return value?.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ?? "";
}

function normalizeRoomId(value?: string) {
  const raw = value?.trim() ?? "";
  const normalized = raw.toLocaleUpperCase().replace(/[^A-Z0-9#]/g, "");
  const hashIndex = normalized.indexOf("#");
  if (hashIndex === -1) return normalized.replace(/[^0-9]/g, "").slice(-7);
  const beforeHash = normalized.slice(0, hashIndex);
  const digits = beforeHash.replace(/[^0-9]/g, "");
  return digits.slice(-7) || normalized.slice(-7);
}

function fuzzyIgnMatches(left?: string, right?: string) {
  const a = normalizeIgn(left);
  const b = normalizeIgn(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const minLength = Math.min(a.length, b.length);
  if (minLength <= 2) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (const char of a) {
    const current = [previous[0] + 1];
    for (let index = 1; index <= b.length; index += 1) {
      const deleteCost = current[index - 1] + 1;
      const insertCost = previous[index] + 1;
      const replaceCost = previous[index - 1] + (char === b[index - 1] ? 0 : 1);
      current[index] = Math.min(deleteCost, insertCost, replaceCost);
    }
    previous = current;
  }
  const distance = previous[b.length];
  const maxLength = Math.max(a.length, b.length);
  return maxLength > 0 && (maxLength - distance) / maxLength >= 0.7;
}

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
    new Date(new Date(match.updatedAt).getTime() + 24 * 60 * 60 * 1000)
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
      "This match chat expired after 24 hours.",
      "CHAT_EXPIRED",
      410,
    );
  return expiresAt;
}

export async function getMatchChat(userId: string, matchId: string) {
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
  const isEvidenceMode = [
    "awaiting_evidence",
    "analyzing",
    "result_review",
    "disputed",
    "settled",
  ].includes(match.status);
  const expiresAt = getChatExpiry(match);
  const messages = await MatchChatMessageModel.find({ matchId })
    .sort({ createdAt: 1 })
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
    ? await resultRepository.listForMatch(matchId)
    : [];
  const myEvidence = evidence.find((item) => String(item.userId) === userId);
  const myAnalysis = myEvidence?.aiAnalysis as
    | {
        winnerIGN?: string;
        roomId?: string;
      }
    | undefined;
  const opponentId =
    String(match.creatorId) === userId
      ? String(match.opponentCaptainId)
      : String(match.creatorId);
  const identityById = new Map(
    users.map((user) => [String(user._id), user.ign ?? ""]),
  );
  // Sender IDs can be absent for an empty chat, so retain the profile fallback
  // only for the evidence-result calculation.
  const currentPlayerIgn =
    identityById.get(userId) ?? (await getCurrentUserIdentity(userId)).ign;
  const opponentIgn =
    identityById.get(opponentId) ??
    (await getCurrentUserIdentity(opponentId)).ign;
  const failedUploadAttempts = isEvidenceMode
    ? await evidenceAttemptRepository.countFailures(matchId, userId)
    : 0;
  const extractedResult = myAnalysis?.winnerIGN
    ? fuzzyIgnMatches(myAnalysis.winnerIGN, currentPlayerIgn)
      ? "win"
      : fuzzyIgnMatches(myAnalysis.winnerIGN, opponentIgn)
        ? "loss"
        : undefined
    : undefined;
  const provisionalResult = myAnalysis?.winnerIGN ? extractedResult : undefined;
  return {
    expiresAt,
    closed:
      isEvidenceMode ||
      match.status === "cancelled" ||
      (match.completedBy?.length ?? 0) > 0,
    matchStatus: match.status,
    failedUploadAttempts,
    result:
      match.status === "settled"
        ? (match.winnerTeam === "A") === (String(match.creatorId) === userId)
          ? "win"
          : "loss"
        : match.status === "disputed"
          ? "hold"
          : provisionalResult,
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
        messages.map((message) => ({
          ...message,
          senderName: nameBySenderId.get(String(message.senderId)) ?? "Player",
        })),
      ),
    ),
  };
}

export async function sendMatchChatMessage(
  userId: string,
  matchId: string,
  rawBody: string,
) {
  const body = messageSchema.parse(rawBody);
  await connectDb();
  const expiresAt = await assertChatOpen(userId, matchId);
  const message = await MatchChatMessageModel.create({
    matchId,
    senderId: userId,
    body,
    expiresAt,
  });
  const user = await UserModel.findById(userId).select("ign").lean();
  return { ...message.toObject(), senderName: user?.ign || "Player" };
}

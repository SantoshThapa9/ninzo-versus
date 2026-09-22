import { z } from "zod";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { matchRepository } from "@/repositories/match.repository";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { resultRepository } from "@/repositories/ops.repository";
import { finalizeMatchEvidence } from "@/services/match.service";

const messageSchema = z.string().trim().min(1, "Write a message first.").max(1000);

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
  if (!match || !match.opponentCaptainId) throw new AppError("Chat opens after a challenge is accepted.", "CHAT_UNAVAILABLE", 404);
  if (String(match.creatorId) !== userId && String(match.opponentCaptainId) !== userId) {
    throw new AppError("Only match participants can use this chat.", "FORBIDDEN", 403);
  }
  return match;
}

function getChatExpiry(match: { chatExpiresAt?: Date; updatedAt: Date }) {
  // Matches accepted before chat expiry was added do not have chatExpiresAt.
  // Their updated time is the acceptance time unless an admin later changed the match.
  return match.chatExpiresAt ?? new Date(new Date(match.updatedAt).getTime() + 24 * 60 * 60 * 1000);
}

async function assertChatOpen(userId: string, matchId: string) {
  let match = await getParticipantMatch(userId, matchId);
  if (match.status === "awaiting_evidence" || match.status === "analyzing") {
    await finalizeMatchEvidence(matchId);
    match = await getParticipantMatch(userId, matchId);
  }
  if (match.status !== "accepted" && match.status !== "live") {
    throw new AppError("Chat is closed while match screenshots are being submitted or reviewed.", "CHAT_CLOSED", 410);
  }
  if ((match.completedBy?.length ?? 0) > 0) {
    throw new AppError("This match was marked complete, so chat is closed for both players.", "CHAT_CLOSED", 410);
  }
  const expiresAt = getChatExpiry(match);
  if (expiresAt <= new Date()) throw new AppError("This match chat expired after 24 hours.", "CHAT_EXPIRED", 410);
  return expiresAt;
}

export async function getMatchChat(userId: string, matchId: string) {
  await connectDb();
  const match = await getParticipantMatch(userId, matchId);
  const isEvidenceMode = ["awaiting_evidence", "analyzing", "result_review", "disputed", "settled"].includes(match.status);
  const expiresAt = getChatExpiry(match);
  const messages = await MatchChatMessageModel.find({ matchId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: 1 })
    .lean();
  const senderIds = [...new Set(messages.map((message) => String(message.senderId)))];
  const profiles = await Promise.all(senderIds.map(async (senderId) => ({
    senderId,
    profile: await playerProfileRepository.findByUserId(senderId),
  })));
  const nameBySenderId = new Map(profiles.map(({ senderId, profile }) => [senderId, profile?.ign ?? "Player"]));
  const evidence = isEvidenceMode ? await resultRepository.listForMatch(matchId) : [];
  const myEvidence = evidence.find((item) => String(item.userId) === userId);
  const myAnalysis = myEvidence?.aiAnalysis as {
    winnerIGN?: string;
    roomId?: string;
  } | undefined;
  const currentPlayerIgn = (await playerProfileRepository.findByUserId(userId))?.ign;
  const opponentId = String(match.creatorId) === userId
    ? String(match.opponentCaptainId)
    : String(match.creatorId);
  const opponentIgn = (await playerProfileRepository.findByUserId(opponentId))?.ign;
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
    closed: isEvidenceMode || (match.completedBy?.length ?? 0) > 0,
    matchStatus: match.status,
    result: match.status === "settled"
      ? (match.winnerTeam === "A") === (String(match.creatorId) === userId) ? "win" : "loss"
      : match.status === "disputed" ? "hold" : provisionalResult,
    evidence: isEvidenceMode
      ? evidence.filter((item) => String(item.userId) === userId).map((item) => ({
          _id: String(item._id),
          userId: String(item.userId),
          kind: item.kind,
          // Private Blob URLs cannot be rendered by a browser. Keep the Blob URL
          // server-only and give authorized players an app URL instead.
          imageUrl: `/api/clash/${matchId}/evidence/${String(item._id)}`,
        }))
      : [],
    messages: JSON.parse(JSON.stringify(messages.map((message) => ({
      ...message,
      senderName: nameBySenderId.get(String(message.senderId)) ?? "Player",
    })))),
  };
}

export async function sendMatchChatMessage(userId: string, matchId: string, rawBody: string) {
  const body = messageSchema.parse(rawBody);
  await connectDb();
  const expiresAt = await assertChatOpen(userId, matchId);
  return MatchChatMessageModel.create({ matchId, senderId: userId, body, expiresAt });
}

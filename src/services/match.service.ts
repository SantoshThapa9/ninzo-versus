import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent } from "@/lib/utils";
import {
  CLASH_DEFAULTS,
  ECONOMY_DEFAULTS,
  MEDIA_DEFAULTS,
} from "@/config/defaults";
import { matchRepository } from "@/repositories/match.repository";
import { MatchModel } from "@/models/match";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { userRepository } from "@/repositories/user.repository";
import {
  applyLedger,
  getOrCreatePlatformUser,
} from "@/services/wallet.service";
import { getPlatformSettings } from "@/services/settings.service";
import { deletePrivateMedia } from "@/services/media.service";
import {
  auditRepository,
  resultRepository,
} from "@/repositories/ops.repository";
import { CoinTxnType, EvidenceKind, MatchStatus } from "@/types/enums";
import {
  analyzeMatchScreenshot,
  validateMatchExtractions,
  type VisionResult,
} from "@/services/ai.service";
import { getCurrentUserIdentity } from "@/services/player-profile.service";

const createMatchSchema = z.object({
  format: z
    .number()
    .int()
    .refine((n) =>
      CLASH_DEFAULTS.teamSizes.includes(n as 1 | 2 | 3 | 4 | 5 | 6),
    ),
  stakeMin: z.number().int().min(ECONOMY_DEFAULTS.minMatchStakeCoins),
  stakeMax: z.number().int().min(ECONOMY_DEFAULTS.minMatchStakeCoins),
  rules: z.string().min(4),
  warningAcknowledged: z.literal(true),
});

const acceptMatchSchema = z.object({
  matchId: z.string(),
  stake: z.number().int().min(ECONOMY_DEFAULTS.minMatchStakeCoins),
  warningAcknowledged: z.literal(true),
});

export async function createClashMatch(userId: string, raw: unknown) {
  const input = createMatchSchema.parse(raw);
  if (input.stakeMax < input.stakeMin) {
    throw new AppError(
      "Stake max must be greater than or equal to stake min.",
      "INVALID_STAKE",
    );
  }

  await connectDb();
  const settings = await getPlatformSettings();
  const currentIdentity = await getCurrentUserIdentity(userId);
  if (!currentIdentity.ign)
    throw new AppError(
      "Save your In Game Name and Free Fire UID in your profile before posting a match.",
      "PROFILE_REQUIRED",
    );

  const duplicate = await MatchModel.findOne({
    creatorId: userId,
    status: MatchStatus.OPEN,
    format: input.format,
    stakeMin: input.stakeMin,
    stakeMax: input.stakeMax,
    rules: input.rules,
  }).lean();
  if (duplicate) return duplicate as typeof duplicate;

  return withTransaction(async (session) => {
    const user = await userRepository.findById(userId, session);
    if (!user || user.status !== "active") {
      throw new AppError(
        "Account cannot create matches.",
        "ACCOUNT_BLOCKED",
        403,
      );
    }
    if (user.availableCoins < input.stakeMax) {
      throw new AppError(
        "Not enough NV Coins to lock the maximum stake.",
        "INSUFFICIENT_FUNDS",
      );
    }

    const match = await matchRepository.create(
      {
        format: input.format,
        creatorId: user._id,
        creatorIgn: currentIdentity.ign,
        rules: input.rules,
        stakeMin: input.stakeMin,
        stakeMax: input.stakeMax,
        lockedStake: input.stakeMax,
        platformFeePercent: settings.platformFeePercent,
        status: MatchStatus.OPEN,
        warningAcknowledgedAt: new Date(),
      },
      session,
    );

    await matchRepository.addParticipant(
      {
        matchId: String(match._id),
        userId,
        team: "A",
        ign: currentIdentity.ign,
        isCaptain: true,
        lockAmount: input.stakeMax,
      },
      session,
    );

    await applyLedger({
      userId,
      type: CoinTxnType.STAKE_LOCK,
      amount: -input.stakeMax,
      availableDelta: -input.stakeMax,
      lockedDelta: input.stakeMax,
      referenceType: "Match",
      referenceId: String(match._id),
      idempotencyKey: `stake-lock:${match._id}:${userId}`,
      session,
    });

    await auditRepository.write({
      actorId: userId,
      action: "match.create",
      entityType: "Match",
      entityId: String(match._id),
      metadata: {
        format: input.format,
        stakeMin: input.stakeMin,
        stakeMax: input.stakeMax,
      },
    });

    return match;
  });
}

export async function acceptClashMatch(userId: string, raw: unknown) {
  const input = acceptMatchSchema.parse(raw);
  await connectDb();
  const currentIdentity = await getCurrentUserIdentity(userId);
  if (!currentIdentity.ign)
    throw new AppError(
      "Save your In Game Name and Free Fire UID in your profile before accepting a match.",
      "PROFILE_REQUIRED",
    );

  return withTransaction(async (session) => {
    const match = await matchRepository.findById(input.matchId, session);
    if (!match || match.status !== MatchStatus.OPEN) {
      throw new AppError("This match is not open.", "MATCH_NOT_OPEN");
    }
    if (String(match.creatorId) === userId) {
      throw new AppError("You cannot accept your own match.", "SELF_ACCEPT");
    }
    if (match.opponentCaptainId && String(match.opponentCaptainId) !== userId) {
      throw new AppError(
        "This challenge already has an opponent.",
        "MATCH_ALREADY_ACCEPTED",
      );
    }
    if (match.opponentCaptainId && String(match.opponentCaptainId) === userId) {
      return match;
    }
    if (input.stake < match.stakeMin || input.stake > match.stakeMax) {
      throw new AppError(
        "Accepted stake must be inside the posted range.",
        "STAKE_OUT_OF_RANGE",
      );
    }
    const user = await userRepository.findById(userId, session);
    if (!user || user.status !== "active") {
      throw new AppError(
        "Account cannot accept matches.",
        "ACCOUNT_BLOCKED",
        403,
      );
    }
    if (user.availableCoins < input.stake) {
      throw new AppError(
        "Not enough NV Coins to lock this stake.",
        "INSUFFICIENT_FUNDS",
      );
    }

    const refund = match.lockedStake - input.stake;
    const prizePool = input.stake * 2;
    const platformFeeAmount = applyPercent(prizePool, match.platformFeePercent);
    const winnerPayout = prizePool - platformFeeAmount;

    match.opponentCaptainId =
      userId as unknown as typeof match.opponentCaptainId;
    match.acceptedStake = input.stake;
    match.prizePool = prizePool;
    match.platformFeeAmount = platformFeeAmount;
    match.winnerPayout = winnerPayout;
    match.chatExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    match.status = MatchStatus.ACCEPTED;
    await match.save({ session });

    await matchRepository.addParticipant(
      {
        matchId: input.matchId,
        userId,
        team: "B",
        ign: currentIdentity.ign,
        isCaptain: true,
        lockAmount: input.stake,
      },
      session,
    );

    await applyLedger({
      userId,
      type: CoinTxnType.STAKE_LOCK,
      amount: -input.stake,
      availableDelta: -input.stake,
      lockedDelta: input.stake,
      referenceType: "Match",
      referenceId: input.matchId,
      idempotencyKey: `stake-lock:${input.matchId}:${userId}`,
      session,
    });

    if (refund > 0) {
      await applyLedger({
        userId: String(match.creatorId),
        type: CoinTxnType.STAKE_REFUND,
        amount: refund,
        availableDelta: refund,
        lockedDelta: -refund,
        referenceType: "Match",
        referenceId: input.matchId,
        idempotencyKey: `stake-refund:${input.matchId}:${match.creatorId}`,
        session,
      });
    }

    match.lockedStake = input.stake;
    await match.save({ session });
    return match;
  });
}

export async function setMatchLive(
  adminId: string,
  matchId: string,
  roomId: string,
  roomPassword: string,
) {
  await connectDb();
  const match = await matchRepository.findById(matchId);
  if (!match || match.status !== MatchStatus.ACCEPTED) {
    throw new AppError("Match cannot go live.", "INVALID_STATUS");
  }
  match.status = MatchStatus.LIVE;
  match.roomId = roomId;
  match.roomPassword = roomPassword;
  await match.save();
  await auditRepository.write({
    actorId: adminId,
    action: "match.live",
    entityType: "Match",
    entityId: matchId,
  });
  return match;
}

function normalizeIgn(value?: string) {
  return value?.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ?? "";
}

function normalizeRoomId(value?: string) {
  const normalized =
    value?.toLocaleUpperCase().replace(/[^A-Z0-9#]/g, "") ?? "";
  if (/^\d{7}$/.test(normalized)) return normalized;
  const hashIndex = normalized.indexOf("#");
  if (hashIndex === -1) return "";
  return normalized.slice(0, hashIndex).match(/\d{7}$/)?.[0] ?? "";
}

function normalizeWinnerIgn(value?: string) {
  const ign = value?.trim();
  if (!ign || ["WARBRINGERS", "HOWLERS"].includes(ign.toLocaleUpperCase()))
    return undefined;
  return ign;
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

export async function submitMatchEvidence(
  userId: string,
  matchId: string,
  kind: EvidenceKind,
  mediaUrl: string,
  blobPathname: string,
) {
  await connectDb();
  const match = await matchRepository.findById(matchId);
  if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
  if (match.status !== MatchStatus.AWAITING_EVIDENCE) {
    throw new AppError(
      "Screenshots can be uploaded after both players mark the match complete.",
      "EVIDENCE_NOT_OPEN",
    );
  }
  if (
    String(match.creatorId) !== userId &&
    String(match.opponentCaptainId) !== userId
  ) {
    throw new AppError(
      "Only match participants can upload screenshots.",
      "FORBIDDEN",
      403,
    );
  }
  if (kind !== EvidenceKind.POST_MATCH_RESULT) {
    throw new AppError(
      "Submit one match-result screenshot.",
      "INVALID_EVIDENCE",
    );
  }
  const uploadedCount = await resultRepository.countForMatchUserKind(
    matchId,
    userId,
    kind,
  );
  if (uploadedCount >= 1)
    throw new AppError(
      "You already submitted this screenshot type.",
      "EVIDENCE_LIMIT",
    );
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MEDIA_DEFAULTS.tempRetentionDays);

  // Use the identity captured when the match was created/accepted. Profile or
  // Atlas edits during a match must not change the evidence being validated.
  const participants = await matchRepository.listParticipants(matchId);
  const platformIgn =
    participants.find((player) => String(player.userId) === userId)?.ign ??
    undefined;
  const opponentId =
    String(match.creatorId) === userId
      ? String(match.opponentCaptainId)
      : String(match.creatorId);
  const opponentIgn = opponentId
    ? (participants.find((player) => String(player.userId) === opponentId)?.ign ??
      undefined)
    : undefined;
  let analysis: VisionResult = { confidence: 0 };
  try {
    analysis =
      (await analyzeMatchScreenshot(blobPathname, [
        platformIgn ?? "",
        opponentIgn ?? "",
      ])) ?? analysis;
  } catch {
    console.error("[match-ai] Screenshot analysis failed.", {
      matchId,
      userId,
    });
  }
  const normalizedRoomId = normalizeRoomId(analysis.roomId);
  const normalizedAnalysis = {
    ...analysis,
    roomId: normalizedRoomId || undefined,
    winnerIGN: normalizeWinnerIgn(analysis.winnerIGN),
  };
  console.info(
    "[match-ai] Normalized room and winner extraction before persisting provisional result.",
    {
      matchId,
      userId,
      normalizedRoomId,
      winnerIGN: normalizedAnalysis.winnerIGN ?? null,
      rawRoomId: analysis.roomId ?? null,
      rawWinnerIGN: analysis.winnerIGN ?? null,
    },
  );
  analysis = normalizedAnalysis;

  if (!analysis.roomId || !analysis.winnerIGN) {
    console.warn(
      "[match-ai] Screenshot rejected: required result details are unreadable.",
      {
        matchId,
        userId,
        hasRoomId: Boolean(analysis.roomId),
        hasWinnerIgn: Boolean(analysis.winnerIGN),
      },
    );
    try {
      await deletePrivateMedia(blobPathname);
    } catch {
      console.error("[match-ai] Could not remove rejected screenshot upload.", {
        matchId,
        userId,
      });
    }
    throw new AppError(
      "We couldn't read the Custom Room ID or winner IGN. Please upload a clear final-result screenshot again.",
      "SCREENSHOT_REUPLOAD_REQUIRED",
      422,
    );
  }

  const submission = await resultRepository.create({
    matchId,
    userId,
    kind,
    mediaUrl,
    blobPathname,
    expiresAt,
  });
  await resultRepository.setAiAnalysis(String(submission._id), analysis);
  console.info("[match-ai] Result screenshot extraction saved.", {
    matchId,
    userId,
  });

  const personalResult = analysis.winnerIGN
    ? fuzzyIgnMatches(analysis.winnerIGN, platformIgn)
      ? ("win" as const)
      : opponentIgn && fuzzyIgnMatches(analysis.winnerIGN, opponentIgn)
        ? ("loss" as const)
        : undefined
    : undefined;

  await MatchModel.findByIdAndUpdate(matchId, {
    $set: {
      provisionalResult: personalResult
        ? personalResult === "win"
          ? "WIN"
          : "LOSS"
        : null,
    },
  });
  await finalizeMatchEvidence(matchId);
  return { submission, personalResult };
}

// Safe to call repeatedly (including while the chat refreshes). Only one
// request can claim the match for finalization.
export async function finalizeMatchEvidence(matchId: string) {
  const evidence = await resultRepository.listForMatch(matchId);
  const resultEvidence = evidence.filter(
    (item) => item.kind === EvidenceKind.POST_MATCH_RESULT,
  );
  const resultUploaders = new Set(
    resultEvidence.map((item) => String(item.userId)),
  );
  // Start finalization only after one result image exists for each captain.
  // This deliberately ignores old/legacy evidence attached to the match.
  if (resultEvidence.length >= 2 && resultUploaders.size === 2) {
    if (resultEvidence.some((item) => !item.aiAnalysis)) {
      console.info(
        "[match-ai] Waiting for both single-image extractions before verification.",
        { matchId },
      );
      return;
    }
    console.info(
      "[match-ai] Both player screenshots found; claiming match for final analysis.",
      { matchId },
    );
    const claimed = await MatchModel.findOneAndUpdate(
      {
        _id: matchId,
        status: { $in: [MatchStatus.AWAITING_EVIDENCE, MatchStatus.ANALYZING] },
        aiAnalysisStartedAt: { $exists: false },
      },
      {
        $set: {
          aiAnalysisStartedAt: new Date(),
          status: MatchStatus.ANALYZING,
        },
      },
      { returnDocument: "after" },
    );
    if (claimed) {
      const creatorEvidence = resultEvidence.find(
        (item) => String(item.userId) === String(claimed.creatorId),
      );
      const opponentEvidence = resultEvidence.find(
        (item) => String(item.userId) === String(claimed.opponentCaptainId),
      );
      if (!creatorEvidence || !opponentEvidence) return;
      const creatorResult = {
        ...(creatorEvidence.aiAnalysis ?? {}),
      } as VisionResult;
      const opponentResult = {
        ...(opponentEvidence.aiAnalysis ?? {}),
      } as VisionResult;
      const normalizedCreatorRoomId = normalizeRoomId(creatorResult.roomId);
      const normalizedOpponentRoomId = normalizeRoomId(opponentResult.roomId);
      creatorResult.roomId = normalizedCreatorRoomId || creatorResult.roomId;
      opponentResult.roomId = normalizedOpponentRoomId || opponentResult.roomId;
      console.info("[match-ai] Normalized room IDs for verification.", {
        matchId,
        creator: {
          normalizedRoomId: normalizedCreatorRoomId ?? null,
          rawRoomId: creatorEvidence.aiAnalysis?.roomId ?? null,
        },
        opponent: {
          normalizedRoomId: normalizedOpponentRoomId ?? null,
          rawRoomId: opponentEvidence.aiAnalysis?.roomId ?? null,
        },
      });
      const sameName = (left?: string, right?: string) =>
        fuzzyIgnMatches(left, right);
      const sameRoom = (left?: string, right?: string) => {
        const a = normalizeRoomId(left);
        const b = normalizeRoomId(right);
        return Boolean(a && b && a === b);
      };
      const complete = (result?: VisionResult) =>
        Boolean(
          result &&
          (result.confidence ?? 0) >= 0.8 &&
          normalizeRoomId(result.roomId) &&
          result.winnerIGN?.trim(),
        );
      const participants = await matchRepository.listParticipants(matchId);
      const creatorIgn = participants.find(
        (player) => String(player.userId) === String(claimed.creatorId),
      )?.ign;
      const opponentIgn = participants.find(
        (player) => String(player.userId) === String(claimed.opponentCaptainId),
      )?.ign;
      const validation =
        creatorResult && opponentResult
          ? await validateMatchExtractions({
              first: creatorResult,
              second: opponentResult,
              players: [creatorIgn ?? "", opponentIgn ?? ""],
              question:
                "Do both screenshots match the same final result and winner? The extracted roomId must be the same at the bottom-left, and the winnerIGN must match the same player name in both images. If the winner is not the same in both screenshots, return valid=false.",
              winnerUserId: creatorIgn ?? opponentIgn ?? "",
            })
          : undefined;
      const common =
        complete(creatorResult) &&
        complete(opponentResult) &&
        sameRoom(creatorResult?.roomId, opponentResult?.roomId) &&
        sameName(creatorResult?.winnerIGN, opponentResult?.winnerIGN) &&
        validation?.valid;
      const creatorWon =
        common && fuzzyIgnMatches(creatorResult?.winnerIGN, creatorIgn);
      const opponentWon =
        common && fuzzyIgnMatches(creatorResult?.winnerIGN, opponentIgn);
      const winnerTeam = creatorWon ? "A" : opponentWon ? "B" : undefined;
      console.info("[match-ai] Final verification inputs and checks.", {
        matchId,
        creator: {
          roomId: creatorResult?.roomId,
          winnerIGN: creatorResult?.winnerIGN,
        },
        opponent: {
          roomId: opponentResult?.roomId,
          winnerIGN: opponentResult?.winnerIGN,
        },
        snapshotPlayers: { creatorIgn, opponentIgn },
        checks: {
          sameRoom: sameRoom(creatorResult?.roomId, opponentResult?.roomId),
          sameWinner: sameName(
            creatorResult?.winnerIGN,
            opponentResult?.winnerIGN,
          ),
          validatorValid: validation?.valid ?? false,
          creatorWon,
          opponentWon,
        },
      });
      if (winnerTeam) {
        claimed.aiWinnerRecommendation = `Team ${winnerTeam}`;
        claimed.aiAnalysis = {
          individual: [creatorResult, opponentResult],
          final: validation,
          verification: "matched",
        };
        claimed.provisionalResult = creatorWon ? "WIN" : "LOSS";
        await claimed.save();
        console.info(
          "[match-ai] Results agree; automatically settling the match.",
          { matchId, winnerTeam },
        );
        await adminSettleMatch(undefined, matchId, winnerTeam);
      } else {
        claimed.aiWinnerRecommendation = "held for admin review";
        claimed.aiAnalysis = {
          individual: [creatorResult, opponentResult],
          final: validation,
          verification: "conflicting or invalid room/winner evidence",
        };
        claimed.provisionalResult = "HOLD";
        claimed.status = MatchStatus.DISPUTED;
        claimed.completedAt = new Date();
        await claimed.save();
        console.warn(
          "[match-ai] Results are unclear or conflicting; match placed on admin hold.",
          { matchId },
        );
      }
    } else {
      console.info(
        "[match-ai] Match analysis was already claimed by another request.",
        { matchId },
      );
    }
  } else {
    console.info(
      "[match-ai] Waiting for one result screenshot from each player.",
      {
        matchId,
        screenshotCount: resultEvidence.length,
        playerCount: resultUploaders.size,
      },
    );
  }
}

export async function confirmMatchCompleted(userId: string, matchId: string) {
  await connectDb();
  const match = await matchRepository.findById(matchId);
  if (!match || !match.opponentCaptainId)
    throw new AppError("Match is not ready for completion.", "MATCH_NOT_READY");
  if (
    String(match.creatorId) !== userId &&
    String(match.opponentCaptainId) !== userId
  ) {
    throw new AppError(
      "Only match participants can confirm completion.",
      "FORBIDDEN",
      403,
    );
  }
  if (
    match.status !== MatchStatus.ACCEPTED &&
    match.status !== MatchStatus.LIVE
  ) {
    throw new AppError(
      "This match cannot be marked complete now.",
      "INVALID_STATUS",
    );
  }
  const completionTime = new Date();
  const updated = await MatchModel.findOneAndUpdate(
    { _id: matchId, status: { $in: [MatchStatus.ACCEPTED, MatchStatus.LIVE] } },
    // One captain ending the match closes the shared chat immediately. Both
    // captains can then submit their two screenshots in the evidence view.
    {
      $addToSet: { completedBy: userId },
      $set: {
        status: MatchStatus.AWAITING_EVIDENCE,
        completedAt: completionTime,
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError("Match not found.", "NOT_FOUND", 404);
  await MatchChatMessageModel.updateMany(
    { matchId },
    {
      $max: {
        expiresAt: new Date(completionTime.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    },
  );
  return updated;
}

export async function undoMatchCompleted(userId: string, matchId: string) {
  await connectDb();
  const match = await matchRepository.findById(matchId);
  if (!match || !match.opponentCaptainId)
    throw new AppError("Match is not ready for completion.", "MATCH_NOT_READY");
  if (
    String(match.creatorId) !== userId &&
    String(match.opponentCaptainId) !== userId
  ) {
    throw new AppError(
      "Only match participants can restart chat.",
      "FORBIDDEN",
      403,
    );
  }
  if (
    match.status !== MatchStatus.ACCEPTED &&
    match.status !== MatchStatus.LIVE
  ) {
    throw new AppError(
      "Chat cannot be restarted after both players confirmed completion.",
      "CHAT_RESTART_UNAVAILABLE",
    );
  }
  const updated = await MatchModel.findOneAndUpdate(
    { _id: matchId, status: { $in: [MatchStatus.ACCEPTED, MatchStatus.LIVE] } },
    { $pull: { completedBy: userId } },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError("Match not found.", "NOT_FOUND", 404);
  return updated;
}

export async function adminSettleMatch(
  adminId: string | undefined,
  matchId: string,
  winnerTeam: "A" | "B" | "DRAW",
) {
  await connectDb();
  return withTransaction(async (session) => {
    const match = await matchRepository.findById(matchId, session);
    if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
    if (match.status === MatchStatus.SETTLED) {
      throw new AppError("Match already settled.", "ALREADY_SETTLED");
    }
    if (!match.acceptedStake || !match.opponentCaptainId) {
      throw new AppError("Match is not ready to settle.", "NOT_READY");
    }

    const participantIds = [
      String(match.creatorId),
      String(match.opponentCaptainId),
    ];
    const winnerId =
      winnerTeam === "A"
        ? participantIds[0]
        : winnerTeam === "B"
          ? participantIds[1]
          : undefined;
    const platform = await getOrCreatePlatformUser(session);
    const stake = match.acceptedStake;
    // The fee is taken from the combined pool: 10 NV + 10 NV = 20 NV pool;
    // at 5%, the winner receives 19 NV.
    const prizePool = stake * 2;
    const platformFeeAmount = applyPercent(prizePool, match.platformFeePercent);
    const winnerPayout = prizePool - platformFeeAmount;
    // A draw returns the remaining pool equally after the platform fee. If a
    // fee cannot be divided evenly, the first captain receives the extra NV.
    const drawPayouts = [
      Math.ceil(winnerPayout / 2),
      Math.floor(winnerPayout / 2),
    ];

    for (const [index, uid] of participantIds.entries()) {
      const drawPayout = winnerId ? 0 : drawPayouts[index];
      await applyLedger({
        userId: uid,
        type: CoinTxnType.STAKE_SETTLE,
        amount: drawPayout,
        availableDelta: drawPayout,
        lockedDelta: -stake,
        referenceType: "Match",
        referenceId: matchId,
        idempotencyKey: `stake-unlock:${matchId}:${uid}`,
        session,
      });
    }

    if (winnerId) {
      await applyLedger({
        userId: winnerId,
        type: CoinTxnType.PRIZE_PAYOUT,
        amount: winnerPayout,
        availableDelta: winnerPayout,
        lockedDelta: 0,
        referenceType: "Match",
        referenceId: matchId,
        idempotencyKey: `prize:${matchId}:${winnerId}`,
        session,
      });
    }

    await applyLedger({
      userId: String(platform._id),
      type: CoinTxnType.PLATFORM_FEE,
      amount: platformFeeAmount,
      availableDelta: platformFeeAmount,
      lockedDelta: 0,
      referenceType: "Match",
      referenceId: matchId,
      idempotencyKey: `fee:${matchId}`,
      metadata: winnerId
        ? { resolution: "winner" }
        : { resolution: "draw", payouts: drawPayouts },
      session,
    });

    match.winnerTeam = winnerTeam === "DRAW" ? null : winnerTeam;
    match.prizePool = prizePool;
    match.platformFeeAmount = platformFeeAmount;
    match.winnerPayout = winnerId ? winnerPayout : 0;
    match.status = MatchStatus.SETTLED;
    match.completedAt = new Date();
    await match.save({ session });
    await MatchChatMessageModel.updateMany(
      { matchId },
      {
        $max: {
          expiresAt: new Date(
            match.completedAt.getTime() + 3 * 24 * 60 * 60 * 1000,
          ),
        },
      },
    );

    await auditRepository.write({
      actorId: adminId,
      action: adminId ? "match.settle" : "match.ai_settle",
      entityType: "Match",
      entityId: matchId,
      metadata: {
        winnerTeam,
        winnerId: winnerId ?? null,
        resolution: winnerId ? "winner" : "draw",
        drawPayouts: winnerId ? undefined : drawPayouts,
        platformFeeAmount,
      },
    });
    return match;
  });
}

export async function listOpenMatches() {
  await connectDb();
  const matches = await matchRepository.listOpen();
  const creatorIds = [
    ...new Set(matches.map((match) => String(match.creatorId))),
  ];
  const identities = await Promise.all(
    creatorIds.map(
      async (userId) => [userId, await getCurrentUserIdentity(userId)] as const,
    ),
  );
  const identityByUserId = new Map(
    identities.map(([userId, identity]) => [userId, identity]),
  );

  return matches.map((match) => {
    const rules = String(match.rules ?? "");
    const headshot = /only headshots:\s*yes/i.test(rules) ? "Yes" : "No";
    const characterSkill = /character skill allowed:\s*yes/i.test(rules)
      ? "Yes"
      : "No";
    return {
      ...match,
      creatorIgn:
        identityByUserId.get(String(match.creatorId))?.ign ||
        match.creatorIgn ||
        "Player 1",
      headshot,
      characterSkill,
    };
  });
}

export async function listActiveMatchesForUser(userId: string) {
  await connectDb();
  const matches = await matchRepository.listActiveForUser(userId);
  const participants = await Promise.all(
    matches.map(async (match) => ({
      match,
      participants: await matchRepository.listParticipants(String(match._id)),
    })),
  );

  const allUserIds = [
    ...new Set(
      participants.flatMap(({ match, participants: players }) => [
        String(match.creatorId),
        ...(match.opponentCaptainId ? [String(match.opponentCaptainId)] : []),
        ...players.map((player) => String(player.userId)),
      ]),
    ),
  ];
  const userIdentityMap = new Map(
    (
      await Promise.all(
        allUserIds.map(
          async (currentUserId) =>
            [
              currentUserId,
              await getCurrentUserIdentity(currentUserId),
            ] as const,
        ),
      )
    ).map(([currentUserId, identity]) => [currentUserId, identity]),
  );

  return participants.map(({ match, participants: players }) => {
    const creator = players.find(
      (player) => String(player.userId) === String(match.creatorId),
    );
    const opponent = players.find(
      (player) => String(player.userId) === String(match.opponentCaptainId),
    );
    const creatorIgn =
      userIdentityMap.get(String(match.creatorId))?.ign ??
      creator?.ign ??
      match.creatorIgn ??
      "Player A";
    const opponentIgn =
      userIdentityMap.get(String(match.opponentCaptainId))?.ign ??
      opponent?.ign ??
      "Player B";
    return {
      ...JSON.parse(JSON.stringify(match)),
      creatorIgn,
      opponentIgn,
      winnerIgn:
        match.winnerTeam === "A"
          ? creatorIgn
          : match.winnerTeam === "B"
            ? opponentIgn
            : null,
    };
  });
}

export async function pruneExpiredMatchHistory(userId?: string) {
  await connectDb();
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const matches = await MatchModel.find({
    ...(userId
      ? { $or: [{ creatorId: userId }, { opponentCaptainId: userId }] }
      : {}),
    completedAt: { $lt: cutoff },
    status: { $in: [MatchStatus.SETTLED, MatchStatus.CANCELLED] },
  }).lean();

  for (const match of matches) {
    await MatchChatMessageModel.deleteMany({ matchId: match._id });
    await resultRepository.deleteManyForMatch(String(match._id));
    await MatchModel.deleteOne({ _id: match._id });
  }
}

export async function listPreviousMatchesForUser(userId: string) {
  await connectDb();
  await pruneExpiredMatchHistory(userId);
  const matches = await matchRepository.listPreviousForUser(userId);
  const participants = await Promise.all(
    matches.map(async (match) => ({
      match,
      participants: await matchRepository.listParticipants(String(match._id)),
    })),
  );
  return participants.map(({ match, participants: players }) => {
    const creator = players.find(
      (player) => String(player.userId) === String(match.creatorId),
    );
    const opponent = players.find(
      (player) => String(player.userId) === String(match.opponentCaptainId),
    );
    // Previous matches are an immutable record of the identities at the time
    // the match was played.
    const creatorIgn = creator?.ign ?? match.creatorIgn ?? "Player A";
    const opponentIgn = opponent?.ign ?? "Player B";
    return {
      ...JSON.parse(JSON.stringify(match)),
      creatorIgn,
      opponentIgn,
      winnerIgn:
        match.winnerTeam === "A"
          ? creatorIgn
          : match.winnerTeam === "B"
            ? opponentIgn
            : null,
    };
  });
}

export async function listMatchesForUser(
  userId: string,
  filter: "open" | "completed" | "on_hold" | "disqualified" = "open",
) {
  await connectDb();
  await pruneExpiredMatchHistory(userId);
  const statusMap = {
    open: [
      MatchStatus.OPEN,
      MatchStatus.ACCEPTED,
      MatchStatus.LIVE,
      MatchStatus.AWAITING_EVIDENCE,
      MatchStatus.ANALYZING,
      MatchStatus.RESULT_REVIEW,
    ],
    completed: [MatchStatus.SETTLED],
    on_hold: [MatchStatus.DISPUTED],
    disqualified: [MatchStatus.CANCELLED],
  } as const;

  const matches = await MatchModel.find({
    $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
    status: { $in: statusMap[filter] },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const participants = await Promise.all(
    matches.map(async (match) => ({
      match,
      participants: await matchRepository.listParticipants(String(match._id)),
    })),
  );
  const allUserIds = [
    ...new Set(
      participants.flatMap(({ match, participants: players }) => [
        String(match.creatorId),
        ...(match.opponentCaptainId ? [String(match.opponentCaptainId)] : []),
        ...players.map((player) => String(player.userId)),
      ]),
    ),
  ];
  const userIdentityMap = new Map(
    (
      await Promise.all(
        allUserIds.map(
          async (currentUserId) =>
            [
              currentUserId,
              await getCurrentUserIdentity(currentUserId),
            ] as const,
        ),
      )
    ).map(([currentUserId, identity]) => [currentUserId, identity]),
  );

  return participants.map(({ match, participants: players }) => {
    // These names describe the two fixed sides of the match, rather than the
    // viewer and their opponent. Using a viewer-relative "opponent" here made
    // the acceptor see the creator in both positions (Creator vs Creator).
    const creator = players.find(
      (player) => String(player.userId) === String(match.creatorId),
    );
    const opponent = players.find(
      (player) => String(player.userId) === String(match.opponentCaptainId),
    );
    const isHistorical =
      match.status === MatchStatus.SETTLED ||
      match.status === MatchStatus.CANCELLED;
    const creatorIgn = isHistorical
      ? (creator?.ign ?? match.creatorIgn ?? "Player A")
      : (userIdentityMap.get(String(match.creatorId))?.ign ??
        creator?.ign ??
        match.creatorIgn ??
        "Player A");
    const opponentIgn = isHistorical
      ? (opponent?.ign ?? "Player B")
      : (userIdentityMap.get(String(match.opponentCaptainId))?.ign ??
        opponent?.ign ??
        "Player B");
    return {
      ...JSON.parse(JSON.stringify(match)),
      creatorIgn,
      opponentIgn,
      winnerIgn:
        match.winnerTeam === "A"
          ? creatorIgn
          : match.winnerTeam === "B"
            ? opponentIgn
            : null,
    };
  });
}

export async function getMatchForUser(
  userId: string,
  matchId: string,
  isAdmin: boolean,
) {
  await connectDb();
  const match = isAdmin
    ? await matchRepository.findByIdWithRoom(matchId)
    : await matchRepository.findById(matchId);
  if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
  const participants = await matchRepository.listParticipants(matchId);
  const identities = await Promise.all(
    participants.map(async (participant) => {
      const currentIdentity = await getCurrentUserIdentity(
        String(participant.userId),
      );
      return {
        userId: String(participant.userId),
        ign: currentIdentity.ign || participant.ign || "Player",
        uid: currentIdentity.uid || participant.uid || "UID not set",
      };
    }),
  );
  const identityByUserId = new Map(
    identities.map((identity) => [identity.userId, identity]),
  );
  const isHistorical =
    match.status === MatchStatus.SETTLED ||
    match.status === MatchStatus.CANCELLED;
  const evidence = await resultRepository.listForMatch(matchId);
  const isParticipant = participants.some((p) => String(p.userId) === userId);
  return {
    match: {
      ...JSON.parse(JSON.stringify(match)),
      creatorIgn: isHistorical
        ? (match.creatorIgn ?? "Player")
        : (identityByUserId.get(String(match.creatorId))?.ign ??
          match.creatorIgn ??
          "Player"),
    },
    participants,
    players: participants.map((participant) => ({
      userId: String(participant.userId),
      // Completed/cancelled matches deliberately retain their saved snapshot.
      ign: isHistorical
        ? (participant.ign ?? "Player")
        : (identityByUserId.get(String(participant.userId))?.ign ??
          participant.ign ??
          "Player"),
      uid: isHistorical
        ? (participant.uid ?? "UID not set")
        : (identityByUserId.get(String(participant.userId))?.uid ??
          participant.uid ??
          "UID not set"),
    })),
    evidence: isParticipant || isAdmin ? evidence : [],
    settings: await getPlatformSettings(),
  };
}

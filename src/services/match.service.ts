import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent, isValidTokenAmount, roundTokens } from "@/lib/utils";
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
  evidenceAttemptRepository,
  resultRepository,
  verifiedRoomIdRepository,
} from "@/repositories/ops.repository";
import { CoinTxnType, EvidenceKind, MatchStatus } from "@/types/enums";
import {
  analyzeMatchScreenshot,
  extractedIgnMatchesPlayer,
  validateMatchScreenshots,
  type VisionResult,
} from "@/services/ai.service";
import { getCurrentUserIdentity } from "@/services/player-profile.service";

const createMatchSchema = z.object({
  format: z
    .number()
    .int()
    .refine(
      (n) => CLASH_DEFAULTS.teamSizes.includes(n as 1),
      //curently only solo focus
      // CLASH_DEFAULTS.teamSizes.includes(n as 1 | 2 | 3 | 4 | 5 | 6),
    ),
  stakeMin: z
    .number()
    .min(ECONOMY_DEFAULTS.minMatchStakeCoins)
    .refine(isValidTokenAmount, {
      message: "NV Tokens can have up to two decimal places.",
    }),
  stakeMax: z
    .number()
    .min(ECONOMY_DEFAULTS.minMatchStakeCoins)
    .refine(isValidTokenAmount, {
      message: "NV Tokens can have up to two decimal places.",
    }),
  rules: z.string().min(4),
  warningAcknowledged: z.literal(true),
});

const acceptMatchSchema = z.object({
  matchId: z.string(),
  stake: z
    .number()
    .min(ECONOMY_DEFAULTS.minMatchStakeCoins)
    .refine(isValidTokenAmount, {
      message: "NV Tokens can have up to two decimal places.",
    }),
  warningAcknowledged: z.literal(true),
});

export async function createClashMatch(userId: string, raw: unknown) {
  const input = createMatchSchema.parse(raw);
  if (input.stakeMax < input.stakeMin) {
    throw new AppError(
      "Maximum match registration must be greater than or equal to the minimum.",
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
        "Not enough NV Tokens for the selected match registration.",
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
      return { match, acceptedNow: false };
    }
    if (input.stake < match.stakeMin || input.stake > match.stakeMax) {
      throw new AppError(
        "Match registration must be inside the posted range.",
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
        "Not enough NV Tokens for this match registration.",
        "INSUFFICIENT_FUNDS",
      );
    }

    const refund = roundTokens(match.lockedStake - input.stake);
    const prizePool = roundTokens(input.stake * 2);
    const platformFeeAmount = applyPercent(prizePool, match.platformFeePercent);
    const winnerPayout = roundTokens(prizePool - platformFeeAmount);

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
    return { match, acceptedNow: true };
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

  const registerUnreadableScreenshot = async (
    reason: string,
  ): Promise<never> => {
    // Each rejection is its own durable record. Counting records avoids
    // Mongoose document-array caching during Next.js development reloads.
    await evidenceAttemptRepository.recordFailure({ matchId, userId, reason });
    const attempt = await evidenceAttemptRepository.countFailures(
      matchId,
      userId,
    );

    if (attempt < 3) {
      try {
        await deletePrivateMedia(blobPathname);
      } catch {
        console.error(
          "[match-ai] Could not remove rejected screenshot upload.",
          {
            matchId,
            userId,
          },
        );
      }
      const remaining = 3 - attempt;
      throw new AppError(
        `${reason} You have ${remaining} screenshot ${remaining === 1 ? "attempt" : "attempts"} remaining.`,
        "SCREENSHOT_REUPLOAD_REQUIRED",
        422,
        { failedUploadAttempts: attempt },
      );
    }

    // Preserve the final failed image so an administrator has the actual
    // evidence the player submitted when deciding the match.
    const submission = await resultRepository.create({
      matchId,
      userId,
      kind,
      mediaUrl,
      blobPathname,
      expiresAt,
      aiAnalysis: { confidence: 0, raw: { rejectionReason: reason } },
    });
    // Keep evidence submission open for the other player. This player's third
    // image is now locked as their evidence, and the match will move to admin
    // review once the other player's evidence is submitted and checked.
    await MatchModel.findByIdAndUpdate(matchId, {
      $set: {
        aiWinnerRecommendation:
          "one player's third screenshot requires admin review",
      },
    });
    await auditRepository.write({
      actorId: userId,
      action: "match.evidence.admin_review_required",
      entityType: "Match",
      entityId: matchId,
      metadata: { reason, attempt, evidenceId: String(submission._id) },
    });
    throw new AppError(
      "Your third screenshot could not be verified. It has been saved for admin review; the other player can still submit their screenshot.",
      "ADMIN_REVIEW_REQUIRED",
      422,
      { failedUploadAttempts: attempt },
    );
  };

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
    ? (participants.find((player) => String(player.userId) === opponentId)
        ?.ign ?? undefined)
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
    await registerUnreadableScreenshot(
      "We couldn't read the required match details from this screenshot.",
    );
  }

  // A room ID enters the permanent registry only when a match is settled.
  // Checking it here prevents an old final-result image from being accepted as
  // evidence for a new match.
  const previouslyVerifiedRoom = await verifiedRoomIdRepository.find(
    analysis.roomId as string,
  );
  if (previouslyVerifiedRoom) {
    console.warn("[match-ai] Screenshot rejected: room ID was already used.", {
      matchId,
      userId,
      roomId: analysis.roomId,
      verifiedMatchId: String(previouslyVerifiedRoom.matchId),
    });
    await registerUnreadableScreenshot(
      "This match screenshot was already used. Do not upload an old screenshot; upload the current match's final-result screenshot.",
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

  const winnerMatchesPlayer = extractedIgnMatchesPlayer(
    analysis.winnerIGN,
    platformIgn,
  );
  const winnerMatchesOpponent = extractedIgnMatchesPlayer(
    analysis.winnerIGN,
    opponentIgn,
  );
  const personalResult =
    winnerMatchesPlayer && !winnerMatchesOpponent
      ? ("win" as const)
      : winnerMatchesOpponent && !winnerMatchesPlayer
        ? ("loss" as const)
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
      const sameRoom = (left?: string, right?: string) => {
        const a = normalizeRoomId(left);
        const b = normalizeRoomId(right);
        return Boolean(a && b && a === b);
      };
      // Confidence is useful for observability, but it is not reliable enough
      // to override two complete Vision API extractions.
      const complete = (result?: VisionResult) =>
        Boolean(
          result && normalizeRoomId(result.roomId) && result.winnerIGN?.trim(),
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
          ? validateMatchScreenshots({
              first: creatorResult,
              second: opponentResult,
              players: [creatorIgn ?? "", opponentIgn ?? ""],
            })
          : undefined;
      const common =
        complete(creatorResult) &&
        complete(opponentResult) &&
        sameRoom(creatorResult?.roomId, opponentResult?.roomId) &&
        validation?.valid;
      const creatorWon = common && validation?.winner === creatorIgn;
      const opponentWon = common && validation?.winner === opponentIgn;
      const winnerTeam = creatorWon ? "A" : opponentWon ? "B" : undefined;
      console.info("[match-ai] Final verification inputs and checks.", {
        matchId,
        creator: {
          roomId: creatorResult?.roomId,
          winnerIGN: creatorResult?.winnerIGN,
          confidence: creatorResult?.confidence ?? null,
        },
        opponent: {
          roomId: opponentResult?.roomId,
          winnerIGN: opponentResult?.winnerIGN,
          confidence: opponentResult?.confidence ?? null,
        },
        snapshotPlayers: { creatorIgn, opponentIgn },
        checks: {
          sameRoom: sameRoom(creatorResult?.roomId, opponentResult?.roomId),
          sameRegisteredWinner: Boolean(validation?.valid),
          validationReason: validation?.reason ?? null,
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
        try {
          await adminSettleMatch(
            undefined,
            matchId,
            winnerTeam,
            normalizeRoomId(creatorResult.roomId),
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "REUSED_ROOM_ID") {
            claimed.aiWinnerRecommendation = "held for reused room ID review";
            claimed.aiAnalysis = {
              individual: [creatorResult, opponentResult],
              final: validation,
              verification: "room ID already verified for another match",
            };
            claimed.provisionalResult = "HOLD";
            claimed.status = MatchStatus.DISPUTED;
            claimed.completedAt = new Date();
            await claimed.save();
            console.warn(
              "[match-ai] Settlement blocked: room ID was already verified.",
              { matchId, roomId: normalizeRoomId(creatorResult.roomId) },
            );
            return;
          }
          throw error;
        }
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
        uploadedByPlayerCount: resultUploaders.size,
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

// This is intentionally safe to call from every chat read/write. There is no
// separate scheduler required for the timeout: the first request after the
// deadline settles the expired match, and the ledger keys keep retries safe.
export async function expireMatchAfterChatTimeout(matchId: string) {
  await connectDb();
  return withTransaction(async (session) => {
    const match = await matchRepository.findById(matchId, session);
    if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);

    if (
      match.status !== MatchStatus.ACCEPTED &&
      match.status !== MatchStatus.LIVE
    ) {
      return match;
    }

    const expiresAt =
      match.chatExpiresAt ??
      new Date(new Date(match.updatedAt).getTime() + 24 * 60 * 60 * 1000);
    if (expiresAt > new Date()) return match;

    if (!match.acceptedStake || !match.opponentCaptainId) return match;
    const participantIds = [
      String(match.creatorId),
      String(match.opponentCaptainId),
    ];

    for (const userId of participantIds) {
      await applyLedger({
        userId,
        type: CoinTxnType.STAKE_REFUND,
        amount: match.acceptedStake,
        availableDelta: match.acceptedStake,
        lockedDelta: -match.acceptedStake,
        referenceType: "Match",
        referenceId: matchId,
        idempotencyKey: `chat-expiry-refund:${matchId}:${userId}`,
        metadata: { reason: "chat_expired" },
        session,
      });
    }

    match.status = MatchStatus.CANCELLED;
    match.completedAt = new Date();
    match.winnerTeam = null;
    match.winnerPayout = 0;
    match.platformFeeAmount = 0;
    await match.save({ session });

    await auditRepository.write({
      action: "match.chat_expired_disqualified",
      entityType: "Match",
      entityId: matchId,
      metadata: { refundedParticipantIds: participantIds },
    });
    return match;
  });
}

export async function adminSettleMatch(
  adminId: string | undefined,
  matchId: string,
  winnerTeam: "A" | "B" | "DRAW",
  verifiedRoomId?: string,
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
    if (verifiedRoomId) {
      try {
        // This write is in the same transaction as settlement, so a room ID is
        // never retained for a match that did not actually complete.
        await verifiedRoomIdRepository.create(
          { roomId: verifiedRoomId, matchId },
          session,
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          throw new AppError(
            "This Custom Room ID has already been verified for another completed match.",
            "REUSED_ROOM_ID",
            409,
          );
        }
        throw error;
      }
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
    const prizePool = roundTokens(stake * 2);
    const platformFeeAmount = applyPercent(prizePool, match.platformFeePercent);
    const winnerPayout = roundTokens(prizePool - platformFeeAmount);
    // A draw returns the remaining pool equally after the platform fee. If a
    // fee cannot be divided evenly, the first captain receives the extra 0.01 NV.
    const drawPayouts = [
      roundTokens(Math.ceil((winnerPayout * 100) / 2) / 100),
      roundTokens(Math.floor((winnerPayout * 100) / 2) / 100),
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

export async function listChallengeAcceptancesForCreator(userId: string) {
  await connectDb();
  const matches = await MatchModel.find({
    creatorId: userId,
    opponentCaptainId: { $exists: true, $ne: null },
    status: {
      $in: [
        MatchStatus.ACCEPTED,
        MatchStatus.LIVE,
        MatchStatus.AWAITING_EVIDENCE,
        MatchStatus.ANALYZING,
        MatchStatus.RESULT_REVIEW,
        MatchStatus.DISPUTED,
      ],
    },
  })
    .select("_id opponentCaptainId chatExpiresAt updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  return Promise.all(
    matches.map(async (match) => ({
      matchId: String(match._id),
      // chatExpiresAt is set precisely when the opponent accepts and does not
      // change as the match later moves to live or evidence review.
      acceptedAt: (match.chatExpiresAt ?? match.updatedAt).toISOString(),
      opponentIgn:
        (await getCurrentUserIdentity(String(match.opponentCaptainId))).ign ||
        "An opponent",
    })),
  );
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

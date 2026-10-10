import { z } from "zod";
import type { ClientSession } from "mongoose";
import { unstable_cache } from "next/cache";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent, isValidTokenAmount, roundTokens } from "@/lib/utils";
import {
  CLASH_CHAT_EXPIRY_MS,
  CLASH_DEFAULTS,
  ECONOMY_DEFAULTS,
  MEDIA_DEFAULTS,
  MATCH_HISTORY_RETENTION_DAYS,
} from "@/config/defaults";
import { matchRepository } from "@/repositories/match.repository";
import { MatchModel } from "@/models/match";
import { MatchChatMessageModel } from "@/models/match-chat-message";
import { userRepository } from "@/repositories/user.repository";
import {
  applyLedger,
  getOrCreatePlatformUser,
} from "@/services/wallet.service";
import { deletePrivateMedia } from "@/services/media.service";
import {
  auditRepository,
  resultRepository,
  verifiedRoomIdRepository,
} from "@/repositories/ops.repository";
import {
  CoinTxnType,
  EVENT_ROUNDS,
  EvidenceKind,
  MatchStatus,
} from "@/types/enums";

import { analyzeMatchScreenshot } from "@/services/image-analysis.service";
import {
  decideDeadlineOutcome,
  decideTwoScreenshotOutcome,
  getMatchEvidenceDeadline,
  parseScreenshotResult,
  type ScreenshotResult,
} from "@/services/match-evidence-rules";

import {
  getCurrentUserIdentities,
  getCurrentUserIdentity,
} from "@/services/player-profile.service";
import { getOrCreateSeasonForDate } from "@/services/season.service";

const createMatchSchema = z.object({
  format: z
    .number()
    .int()
    .refine((n) => CLASH_DEFAULTS.teamSizes.includes(n as 1 | 2 | 4)),
  rounds: z
    .number()
    .int()
    .refine(
      (rounds) =>
        EVENT_ROUNDS.includes(rounds as (typeof EVENT_ROUNDS)[number]),
      { message: "Choose a valid round count." },
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

async function discardRejectedEvidenceUpload(
  matchId: string,
  userId: string,
  blobPathname: string,
) {
  try {
    await deletePrivateMedia(blobPathname);
  } catch (error) {
    console.error("[match-ai] Could not remove rejected screenshot upload.", {
      matchId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function assertNoOpenMatch(userId: string, session: ClientSession) {
  if (await matchRepository.hasOpenForUser(userId, session)) {
    throw new AppError(
      "You already have an open challenge. You can accept or create another challenge after it is no longer open.",
      "OPEN_MATCH_EXISTS",
    );
  }
}

export async function createClashMatch(userId: string, raw: unknown) {
  const input = createMatchSchema.parse(raw);
  if (input.stakeMax < input.stakeMin) {
    throw new AppError(
      "Maximum match registration must be greater than or equal to the minimum.",
      "INVALID_STAKE",
    );
  }

  await connectDb();
  const season = await getOrCreateSeasonForDate(new Date());
  const currentIdentity = await getCurrentUserIdentity(userId);
  if (!currentIdentity.ign)
    throw new AppError(
      "Save your In Game Name in your profile before posting a match.",
      "PROFILE_REQUIRED",
    );

  return withTransaction(async (session) => {
    const user = await userRepository.findById(userId, session);
    if (!user || user.status !== "active") {
      throw new AppError(
        "Account cannot create matches.",
        "ACCOUNT_BLOCKED",
        403,
      );
    }
    await assertNoOpenMatch(userId, session);
    if (user.availableCoins < input.stakeMax) {
      throw new AppError(
        "Not enough NV Tokens for the selected match registration.",
        "INSUFFICIENT_FUNDS",
      );
    }

    const match = await matchRepository.create(
      {
        format: input.format,
        seasonId: season._id,
        creatorId: user._id,
        creatorIgn: currentIdentity.ign,
        rounds: input.rounds,
        rules: input.rules,
        stakeMin: input.stakeMin,
        stakeMax: input.stakeMax,
        lockedStake: input.stakeMax,
        platformFeePercent: ECONOMY_DEFAULTS.platformFeePercent,
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
      "Save your In Game Name in your profile before accepting a match.",
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
    await assertNoOpenMatch(userId, session);
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
    match.chatExpiresAt = new Date(Date.now() + CLASH_CHAT_EXPIRY_MS);
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

export async function deleteOpenClashMatch(userId: string, matchId: string) {
  await connectDb();
  return withTransaction(async (session) => {
    const match = await matchRepository.findById(matchId, session);
    if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
    if (String(match.creatorId) !== userId) {
      throw new AppError(
        "Only the challenge creator can delete this post.",
        "FORBIDDEN",
        403,
      );
    }
    if (match.status !== MatchStatus.OPEN) {
      throw new AppError(
        "Only an open challenge post can be deleted.",
        "MATCH_NOT_OPEN",
      );
    }

    await applyLedger({
      userId,
      type: CoinTxnType.STAKE_REFUND,
      amount: match.lockedStake,
      availableDelta: match.lockedStake,
      lockedDelta: -match.lockedStake,
      referenceType: "Match",
      referenceId: matchId,
      idempotencyKey: `post-delete-refund:${matchId}:${userId}`,
      session,
    });

    match.status = MatchStatus.CANCELLED;
    match.completedAt = new Date();
    await match.save({ session });

    await auditRepository.write({
      actorId: userId,
      action: "match.post_deleted",
      entityType: "Match",
      entityId: matchId,
      metadata: { refundedStake: match.lockedStake },
    });

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

export async function submitMatchEvidence(
  userId: string,
  matchId: string,
  kind: EvidenceKind,
  mediaUrl: string,
  blobPathname: string,
) {
  await connectDb();
  let match = await matchRepository.findById(matchId);
  if (!match) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError("Match not found.", "NOT_FOUND", 404);
  }
  if (
    match.status === MatchStatus.AWAITING_EVIDENCE &&
    match.evidenceDeadlineAt &&
    match.evidenceDeadlineAt <= new Date()
  ) {
    await expireMatchEvidenceDeadline(matchId);
    match = await matchRepository.findById(matchId);
  }
  if (!match) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError("Match not found.", "NOT_FOUND", 404);
  }
  if (match.status !== MatchStatus.AWAITING_EVIDENCE) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError(
      "Screenshots can be uploaded after both players mark the match complete.",
      "EVIDENCE_NOT_OPEN",
    );
  }
  if (
    String(match.creatorId) !== userId &&
    String(match.opponentCaptainId) !== userId
  ) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError(
      "Only match participants can upload screenshots.",
      "FORBIDDEN",
      403,
    );
  }
  if (kind !== EvidenceKind.POST_MATCH_RESULT) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError(
      "Submit one match-result screenshot.",
      "INVALID_EVIDENCE",
    );
  }
  if (await resultRepository.countForMatchUserKind(matchId, userId, kind)) {
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw new AppError(
      "You already submitted this screenshot type.",
      "EVIDENCE_LIMIT",
    );
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MEDIA_DEFAULTS.tempRetentionDays);

  let submission: Awaited<ReturnType<typeof resultRepository.create>>;
  try {
    submission = await withTransaction(async (session) => {
      const current = await matchRepository.findById(matchId, session);
      if (
        !current ||
        current.status !== MatchStatus.AWAITING_EVIDENCE ||
        (current.evidenceDeadlineAt && current.evidenceDeadlineAt <= new Date())
      ) {
        throw new AppError(
          "The screenshot submission deadline has passed.",
          "EVIDENCE_DEADLINE_PASSED",
          409,
        );
      }
      if (
        String(current.creatorId) !== userId &&
        String(current.opponentCaptainId) !== userId
      ) {
        throw new AppError(
          "Only match participants can upload screenshots.",
          "FORBIDDEN",
          403,
        );
      }
      if (
        await resultRepository.countForMatchUserKind(
          matchId,
          userId,
          kind,
          session,
        )
      ) {
        throw new AppError(
          "You already submitted this screenshot.",
          "EVIDENCE_LIMIT",
          409,
        );
      }
      const saved = await resultRepository.create(
        {
          matchId,
          userId,
          kind,
          mediaUrl,
          blobPathname,
          expiresAt,
        },
        session,
      );
      const deadlineUpdate = await matchRepository.addEvidenceSubmission(
        matchId,
        getMatchEvidenceDeadline(saved.createdAt),
        new Date(),
        session,
      );
      if (!deadlineUpdate.matchedCount) {
        throw new AppError(
          "The screenshot submission deadline has passed.",
          "EVIDENCE_DEADLINE_PASSED",
          409,
        );
      }
      return saved;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
      throw new AppError(
        "You already submitted this screenshot.",
        "EVIDENCE_LIMIT",
        409,
      );
    }
    await discardRejectedEvidenceUpload(matchId, userId, blobPathname);
    throw error;
  }

  let result: ScreenshotResult = "UNREADABLE";
  let extractionFailed = false;
  try {
    result = parseScreenshotResult(await analyzeMatchScreenshot(blobPathname));
  } catch (error) {
    extractionFailed = true;
    console.error(
      "[match-ai] Screenshot analysis failed; saved for manual review.",
      {
        matchId,
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
  await resultRepository.setAiAnalysis(String(submission._id), {
    result,
    extractionFailed,
  });
  await MatchModel.updateOne(
    {
      _id: matchId,
      status: { $in: [MatchStatus.AWAITING_EVIDENCE, MatchStatus.ANALYZING] },
    },
    {
      $set: {
        provisionalResult:
          result === "VICTORY" ? "WIN" : result === "DEFEAT" ? "LOSS" : null,
      },
    },
  );
  await finalizeMatchEvidence(matchId);
  return {
    submission,
    personalResult:
      result === "VICTORY"
        ? ("win" as const)
        : result === "DEFEAT"
          ? ("loss" as const)
          : ("unreadable" as const),
  };
}

export async function finalizeMatchEvidence(matchId: string) {
  const evidence = (await resultRepository.listForMatch(matchId)).filter(
    (item) => item.kind === EvidenceKind.POST_MATCH_RESULT,
  );
  const match = await matchRepository.findById(matchId);
  if (
    !match ||
    ![MatchStatus.AWAITING_EVIDENCE, MatchStatus.ANALYZING].includes(
      match.status,
    )
  ) {
    return;
  }

  const creatorEvidence = evidence.find(
    (item) => String(item.userId) === String(match.creatorId),
  );
  const opponentEvidence = evidence.find(
    (item) => String(item.userId) === String(match.opponentCaptainId),
  );
  if (!creatorEvidence || !opponentEvidence) return;
  if (!creatorEvidence.aiAnalysis || !opponentEvidence.aiAnalysis) return;

  const creatorResult = parseScreenshotResult(
    (creatorEvidence.aiAnalysis as { result?: unknown }).result,
  );
  const opponentResult = parseScreenshotResult(
    (opponentEvidence.aiAnalysis as { result?: unknown }).result,
  );
  console.info("[match-ai] Finalizing extracted screenshot results.", {
    matchId,
    creatorResult,
    opponentResult,
    creatorExtractionFailed: Boolean(
      (creatorEvidence.aiAnalysis as { extractionFailed?: unknown })
        .extractionFailed,
    ),
    opponentExtractionFailed: Boolean(
      (opponentEvidence.aiAnalysis as { extractionFailed?: unknown })
        .extractionFailed,
    ),
  });
  const outcome = decideTwoScreenshotOutcome(creatorResult, opponentResult);
  if (outcome.kind === "winner") {
    const winnerTeam = outcome.team;
    try {
      await adminSettleMatch(undefined, matchId, winnerTeam);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "ALREADY_SETTLED") {
        throw error;
      }
    }
    return;
  }

  const reason = `Held for admin review: ${outcome.reason}`;
  await withTransaction(async (session) => {
    const held = await MatchModel.findOneAndUpdate(
      {
        _id: matchId,
        status: { $in: [MatchStatus.AWAITING_EVIDENCE, MatchStatus.ANALYZING] },
      },
      {
        $set: {
          status: MatchStatus.DISPUTED,
          provisionalResult: "HOLD",
          aiWinnerRecommendation: reason,
          completedAt: new Date(),
        },
      },
      { returnDocument: "after", session },
    );
    if (!held) return;
    await resultRepository.retainForAdminReview(matchId, session);
    await auditRepository.write(
      {
        action: "match.evidence.admin_review_required",
        entityType: "Match",
        entityId: matchId,
        metadata: {
          reason,
          creatorResult,
          opponentResult,
          evidenceIds: [
            String(creatorEvidence._id),
            String(opponentEvidence._id),
          ],
        },
      },
      session,
    );
  });
}

export async function expireMatchEvidenceDeadline(matchId: string) {
  await connectDb();
  const now = new Date();
  const decision = await withTransaction(async (session) => {
    const match = await matchRepository.findById(matchId, session);
    if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
    const existingDeadlineOutcome =
      match.status === MatchStatus.DISPUTED &&
      match.aiWinnerRecommendation?.startsWith("Deadline expired:");
    const existingDeadlineWin =
      existingDeadlineOutcome &&
      match.aiWinnerRecommendation?.startsWith(
        "Deadline expired: lone VICTORY",
      );
    if (
      !existingDeadlineWin &&
      (![MatchStatus.AWAITING_EVIDENCE, MatchStatus.ANALYZING].includes(
        match.status,
      ) ||
        !match.evidenceDeadlineAt ||
        match.evidenceDeadlineAt > now)
    ) {
      return { kind: "none" as const };
    }

    const evidence = (
      await resultRepository.listForMatch(matchId, session)
    ).filter((item) => item.kind === EvidenceKind.POST_MATCH_RESULT);
    if (evidence.length === 0) {
      if (!match.acceptedStake || !match.opponentCaptainId) {
        throw new AppError(
          "Cannot refund a match with missing stake or opponent details.",
          "MATCH_NOT_READY",
        );
      }
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
          idempotencyKey: `evidence-deadline-refund:${matchId}:${userId}`,
          metadata: { reason: "no_screenshots_before_deadline" },
          session,
        });
      }
      match.status = MatchStatus.CANCELLED;
      match.completedAt = now;
      match.winnerTeam = null;
      match.winnerPayout = 0;
      match.platformFeeAmount = 0;
      match.aiWinnerRecommendation =
        "Deadline expired: no screenshots submitted. Match disqualified and both players' NV Tokens have been returned.";
      await match.save({ session });
      await auditRepository.write(
        {
          action: "match.evidence_deadline_disqualified",
          entityType: "Match",
          entityId: matchId,
          metadata: { refundedParticipantIds: participantIds },
        },
        session,
      );
      return { kind: "disqualified" as const };
    }
    if (evidence.length !== 1) {
      if (evidence.length > 1) {
        await resultRepository.markUnanalyzedAsUnavailable(matchId, session);
      }
      return {
        kind: evidence.length > 1 ? ("finalize" as const) : ("none" as const),
      };
    }

    const submission = evidence[0];
    const result = parseScreenshotResult(
      (submission.aiAnalysis as { result?: unknown } | undefined)?.result,
    );
    const submittedBy = String(submission.userId);
    const winnerTeam: "A" | "B" | undefined =
      submittedBy === String(match.creatorId)
        ? "A"
        : submittedBy === String(match.opponentCaptainId)
          ? "B"
          : undefined;
    if (decideDeadlineOutcome(result) === "award" && winnerTeam) {
      if (!existingDeadlineWin) {
        match.status = MatchStatus.DISPUTED;
        match.provisionalResult = "WIN";
        match.aiWinnerRecommendation =
          "Deadline expired: lone VICTORY screenshot awarded automatically.";
        await match.save({ session });
      }
      return { kind: "award" as const, winnerTeam };
    }

    match.status = MatchStatus.DISPUTED;
    match.provisionalResult = "HOLD";
    match.aiWinnerRecommendation =
      result === "DEFEAT"
        ? "Deadline expired: lone DEFEAT screenshot held for admin review."
        : result === "UNREADABLE"
          ? "Deadline expired: result could not be determined; held for admin review."
          : "Deadline expired: screenshot uploader did not match a participant; held for admin review.";
    match.completedAt = now;
    await match.save({ session });
    await resultRepository.retainForAdminReview(matchId, session);
    await auditRepository.write(
      {
        action: "match.evidence.admin_review_required",
        entityType: "Match",
        entityId: matchId,
        metadata: {
          reason: "evidence_deadline",
          result,
          submittedBy,
        },
      },
      session,
    );
    return { kind: "review" as const, result };
  });

  if (decision.kind === "award") {
    try {
      await adminSettleMatch(undefined, matchId, decision.winnerTeam);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "ALREADY_SETTLED") {
        throw error;
      }
    }
  } else if (decision.kind === "finalize") {
    await finalizeMatchEvidence(matchId);
  }
}

export async function processExpiredMatchEvidenceDeadlines() {
  await connectDb();
  const expired = await matchRepository.listExpiredEvidenceDeadlines(
    new Date(),
  );
  let processed = 0;
  for (const match of expired) {
    await expireMatchEvidenceDeadline(String(match._id));
    processed += 1;
  }
  return { processed };
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
        evidenceDeadlineAt: getMatchEvidenceDeadline(completionTime),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError("Match not found.", "NOT_FOUND", 404);
  await MatchChatMessageModel.updateMany(
    { matchId },
    {
      $max: {
        expiresAt: new Date(
          completionTime.getTime() +
            MATCH_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    },
  );
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
      new Date(new Date(match.updatedAt).getTime() + CLASH_CHAT_EXPIRY_MS);
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
  const completedAt = new Date();
  const season = await getOrCreateSeasonForDate(completedAt);
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

    for (const [index, participantId] of participantIds.entries()) {
      const drawPayout = winnerId ? 0 : drawPayouts[index];
      await applyLedger({
        userId: participantId,
        type: CoinTxnType.STAKE_SETTLE,
        amount: drawPayout,
        availableDelta: drawPayout,
        lockedDelta: -stake,
        referenceType: "Match",
        referenceId: matchId,
        idempotencyKey: `stake-unlock:${matchId}:${participantId}`,
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
    match.completedAt = completedAt;
    match.seasonId = season._id;
    await match.save({ session });
    const screenshotExpiresAt = new Date(
      completedAt.getTime() +
        MEDIA_DEFAULTS.tempRetentionDays * 24 * 60 * 60 * 1000,
    );
    await resultRepository.releaseAdminReviewRetention(
      matchId,
      screenshotExpiresAt,
      session,
    );
    // Only a decisive result counts as a played match in the rankings.
    if (winnerId) {
      await userRepository.recordSettledMatchResult(
        [participantIds[0], participantIds[1]],
        winnerId,
        season._id,
        session,
      );
    }
    await MatchChatMessageModel.updateMany(
      { matchId },
      {
        $max: {
          expiresAt: new Date(
            match.completedAt.getTime() +
              MATCH_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
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
        countsAsPlayedMatch: Boolean(winnerId),
        drawPayouts: winnerId ? undefined : drawPayouts,
        platformFeeAmount,
      },
    });
    return match;
  });
}

const getCachedOpenMatches = unstable_cache(
  async () => {
    await connectDb();
    const matches = await matchRepository.listOpen();
    const identities = await getCurrentUserIdentities(
      matches.map((match) => String(match.creatorId)),
    );

    return matches.map((match) => {
      const rules = String(match.rules ?? "");

      return {
        _id: String(match._id),
        creatorIgn:
          identities.get(String(match.creatorId))?.ign ||
          match.creatorIgn ||
          "Player 1",
        format: match.format,
        rounds: match.rounds ?? 7,
        stakeMin: match.stakeMin,
        stakeMax: match.stakeMax,
        headshot: /only headshots:\s*yes/i.test(rules) ? "Yes" : "No",
        characterSkill: /character skill allowed:\s*yes/i.test(rules)
          ? "Yes"
          : "No",
      };
    });
  },
  ["public-open-matches"],
  { revalidate: 10, tags: ["public-open-matches"] },
);

export async function listOpenMatches() {
  return getCachedOpenMatches();
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
  const cutoff = new Date(
    Date.now() - MATCH_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const matches = await MatchModel.find({
    ...(userId
      ? { $or: [{ creatorId: userId }, { opponentCaptainId: userId }] }
      : {}),
    completedAt: { $lt: cutoff },
    status: { $in: [MatchStatus.SETTLED, MatchStatus.CANCELLED] },
  })
    .select("_id")
    .maxTimeMS(8_000)
    .lean();

  if (!matches.length) return;
  const matchIds = matches.map((match) => String(match._id));
  await Promise.all([
    MatchChatMessageModel.deleteMany({ matchId: { $in: matchIds } }),
    resultRepository.deleteManyForMatches(matchIds),
  ]);
  await MatchModel.deleteMany({ _id: { $in: matchIds } });
}

export async function listPreviousMatchesForUser(userId: string) {
  await connectDb();
  await pruneExpiredMatchHistory(userId);
  const matches = await matchRepository.listPreviousForUser(userId);
  if (!matches.length) return [];
  const allParticipants = await matchRepository.listParticipantsForMatches(
    matches.map((match) => String(match._id)),
  );
  const participantsByMatchId = new Map<string, typeof allParticipants>();
  for (const participant of allParticipants) {
    const matchId = String(participant.matchId);
    const matchParticipants = participantsByMatchId.get(matchId) ?? [];
    matchParticipants.push(participant);
    participantsByMatchId.set(matchId, matchParticipants);
  }
  const participants = matches.map((match) => ({
    match,
    participants: participantsByMatchId.get(String(match._id)) ?? [],
  }));
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
    .maxTimeMS(8_000)
    .lean();

  if (!matches.length) return [];
  const allParticipants = await matchRepository.listParticipantsForMatches(
    matches.map((match) => String(match._id)),
  );
  const participantsByMatchId = new Map<string, typeof allParticipants>();
  for (const participant of allParticipants) {
    const matchId = String(participant.matchId);
    const matchParticipants = participantsByMatchId.get(matchId) ?? [];
    matchParticipants.push(participant);
    participantsByMatchId.set(matchId, matchParticipants);
  }
  const participants = matches.map((match) => ({
    match,
    participants: participantsByMatchId.get(String(match._id)) ?? [],
  }));
  const allUserIds = [
    ...new Set(
      participants.flatMap(({ match, participants: players }) => [
        String(match.creatorId),
        ...(match.opponentCaptainId ? [String(match.opponentCaptainId)] : []),
        ...players.map((player) => String(player.userId)),
      ]),
    ),
  ];
  const userIdentityMap = await getCurrentUserIdentities(allUserIds);

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
  const isHistorical =
    match.status === MatchStatus.SETTLED ||
    match.status === MatchStatus.CANCELLED;
  const isParticipant = participants.some((p) => String(p.userId) === userId);

  const [identityByUserId, evidence] = await Promise.all([
    getCurrentUserIdentities(
      isHistorical
        ? []
        : participants.map((participant) => String(participant.userId)),
    ),
    isParticipant || isAdmin
      ? resultRepository.listForMatch(matchId)
      : Promise.resolve([]),
  ]);

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
    })),
    evidence: isParticipant || isAdmin ? evidence : [],
  };
}

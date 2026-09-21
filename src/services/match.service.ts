import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent } from "@/lib/utils";
import { CLASH_DEFAULTS } from "@/config/defaults";
import { matchRepository } from "@/repositories/match.repository";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { userRepository } from "@/repositories/user.repository";
import { applyLedger, getOrCreatePlatformUser } from "@/services/wallet.service";
import { getPlatformSettings } from "@/services/settings.service";
import { auditRepository, resultRepository } from "@/repositories/ops.repository";
import { CoinTxnType, EvidenceKind, MatchStatus } from "@/types/enums";
import { analyzeMatchScreenshot } from "@/services/ai.service";

const createMatchSchema = z.object({
  format: z.number().int().refine((n) => CLASH_DEFAULTS.teamSizes.includes(n as 1 | 2 | 3 | 4 | 5 | 6)),
  stakeMin: z.number().int().positive(),
  stakeMax: z.number().int().positive(),
  rules: z.string().min(4),
  ign: z.string().min(2).max(20),
  warningAcknowledged: z.literal(true),
});

const acceptMatchSchema = z.object({
  matchId: z.string(),
  stake: z.number().int().positive(),
  ign: z.string().min(2).max(20),
  warningAcknowledged: z.literal(true),
});

export async function createClashMatch(userId: string, raw: unknown) {
  const input = createMatchSchema.parse(raw);
  if (input.stakeMax < input.stakeMin) {
    throw new AppError("Stake max must be greater than or equal to stake min.", "INVALID_STAKE");
  }

  await connectDb();
  const settings = await getPlatformSettings();
  const profile = await playerProfileRepository.upsert(userId, input.ign);

  return withTransaction(async (session) => {
    const user = await userRepository.findById(userId, session);
    if (!user || user.status !== "active") {
      throw new AppError("Account cannot create matches.", "ACCOUNT_BLOCKED", 403);
    }
    if (user.availableCoins < input.stakeMax) {
      throw new AppError("Not enough NV Coins to lock the maximum stake.", "INSUFFICIENT_FUNDS");
    }

    const match = await matchRepository.create(
      {
        format: input.format,
        creatorId: user._id,
        creatorIgn: profile.ign,
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
        ign: profile.ign,
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
      metadata: { format: input.format, stakeMin: input.stakeMin, stakeMax: input.stakeMax },
    });

    return match;
  });
}

export async function acceptClashMatch(userId: string, raw: unknown) {
  const input = acceptMatchSchema.parse(raw);
  await connectDb();
  await playerProfileRepository.upsert(userId, input.ign);

  return withTransaction(async (session) => {
    const match = await matchRepository.findById(input.matchId, session);
    if (!match || match.status !== MatchStatus.OPEN) {
      throw new AppError("This match is not open.", "MATCH_NOT_OPEN");
    }
    if (String(match.creatorId) === userId) {
      throw new AppError("You cannot accept your own match.", "SELF_ACCEPT");
    }
    if (input.stake < match.stakeMin || input.stake > match.stakeMax) {
      throw new AppError("Accepted stake must be inside the posted range.", "STAKE_OUT_OF_RANGE");
    }

    const refund = match.lockedStake - input.stake;
    const prizePool = input.stake * 2;
    const platformFeeAmount = applyPercent(prizePool, match.platformFeePercent);
    const winnerPayout = prizePool - platformFeeAmount;

    match.opponentCaptainId = userId as unknown as typeof match.opponentCaptainId;
    match.acceptedStake = input.stake;
    match.prizePool = prizePool;
    match.platformFeeAmount = platformFeeAmount;
    match.winnerPayout = winnerPayout;
    match.status = MatchStatus.ACCEPTED;
    await match.save({ session });

    await matchRepository.addParticipant(
      {
        matchId: input.matchId,
        userId,
        team: "B",
        ign: input.ign,
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

export async function setMatchLive(adminId: string, matchId: string, roomId: string, roomPassword: string) {
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
  const match = await matchRepository.findById(matchId);
  if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
  const settings = await getPlatformSettings();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + settings.mediaRetentionDays);

  const aiAnalysis =
    kind === EvidenceKind.VIDEO ? undefined : await analyzeMatchScreenshot(mediaUrl);

  const submission = await resultRepository.create({
    matchId,
    userId,
    kind,
    mediaUrl,
    blobPathname,
    expiresAt,
    aiAnalysis,
  });

  if (match.status === MatchStatus.LIVE || match.status === MatchStatus.ACCEPTED) {
    match.status = MatchStatus.AWAITING_EVIDENCE;
    await match.save();
  }
  return submission;
}

export async function adminSettleMatch(
  adminId: string,
  matchId: string,
  winnerTeam: "A" | "B",
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

    const winnerId =
      winnerTeam === "A" ? String(match.creatorId) : String(match.opponentCaptainId);
    const loserId =
      winnerTeam === "A" ? String(match.opponentCaptainId) : String(match.creatorId);
    const platform = await getOrCreatePlatformUser(session);
    const stake = match.acceptedStake;

    for (const uid of [winnerId, loserId]) {
      await applyLedger({
        userId: uid,
        type: CoinTxnType.STAKE_SETTLE,
        amount: 0,
        availableDelta: 0,
        lockedDelta: -stake,
        referenceType: "Match",
        referenceId: matchId,
        idempotencyKey: `stake-unlock:${matchId}:${uid}`,
        session,
      });
    }

    await applyLedger({
      userId: winnerId,
      type: CoinTxnType.PRIZE_PAYOUT,
      amount: match.winnerPayout,
      availableDelta: match.winnerPayout,
      lockedDelta: 0,
      referenceType: "Match",
      referenceId: matchId,
      idempotencyKey: `prize:${matchId}:${winnerId}`,
      session,
    });

    await applyLedger({
      userId: String(platform._id),
      type: CoinTxnType.PLATFORM_FEE,
      amount: match.platformFeeAmount,
      availableDelta: match.platformFeeAmount,
      lockedDelta: 0,
      referenceType: "Match",
      referenceId: matchId,
      idempotencyKey: `fee:${matchId}`,
      session,
    });

    match.winnerTeam = winnerTeam;
    match.status = MatchStatus.SETTLED;
    await match.save({ session });

    await auditRepository.write({
      actorId: adminId,
      action: "match.settle",
      entityType: "Match",
      entityId: matchId,
      metadata: { winnerTeam, winnerId },
    });
    return match;
  });
}

export async function listOpenMatches() {
  await connectDb();
  return matchRepository.listOpen();
}

export async function getMatchForUser(userId: string, matchId: string, isAdmin: boolean) {
  await connectDb();
  const match = isAdmin
    ? await matchRepository.findByIdWithRoom(matchId)
    : await matchRepository.findById(matchId);
  if (!match) throw new AppError("Match not found.", "NOT_FOUND", 404);
  const participants = await matchRepository.listParticipants(matchId);
  const evidence = await resultRepository.listForMatch(matchId);
  const isParticipant = participants.some((p) => String(p.userId) === userId);
  return {
    match: JSON.parse(JSON.stringify(match)),
    participants,
    evidence: isParticipant || isAdmin ? evidence : [],
    settings: await getPlatformSettings(),
  };
}

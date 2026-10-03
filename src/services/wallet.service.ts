import mongoose from "mongoose";
import { AppError } from "@/lib/errors";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { roundTokens } from "@/lib/utils";
import { DAILY_FREE_REWARD_SCHEDULE } from "@/config/defaults";
import { userRepository } from "@/repositories/user.repository";
import { ledgerRepository } from "@/repositories/finance.repository";
import { CoinTxnType, UserRole } from "@/types/enums";
import bcrypt from "bcryptjs";

type LedgerInput = {
  userId: string;
  type: CoinTxnType;
  amount: number;
  availableDelta: number;
  lockedDelta: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  accountEmail?: string;
  metadata?: unknown;
  session: mongoose.ClientSession;
};

// Daily rewards use UTC calendar days. Keeping the day in the ledger reference
// makes the eligibility rule independently auditable from the transaction time.
export function getRewardClaimDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailyRewardIdempotencyKey(userId: string, claimDay: string) {
  return `daily-free-reward:${userId}:${claimDay}`;
}

type DailyRewardTransaction = {
  referenceId: string;
  metadata?: unknown;
};

function dayBefore(claimDay: string) {
  const day = new Date(`${claimDay}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return getRewardClaimDay(day);
}

function rewardDayFor(transaction: DailyRewardTransaction) {
  const rewardDay = (transaction.metadata as { rewardDay?: unknown } | undefined)?.rewardDay;
  // Claims made before the seven-day schedule are preserved as Day 1 records.
  return typeof rewardDay === "number" && Number.isInteger(rewardDay) && rewardDay >= 1 && rewardDay <= DAILY_FREE_REWARD_SCHEDULE.length
    ? rewardDay
    : 1;
}

function getNextDailyReward(transactions: DailyRewardTransaction[], claimDay: string) {
  const today = transactions.find((transaction) => transaction.referenceId === claimDay);
  if (today) {
    const rewardDay = rewardDayFor(today);
    return { claimed: true, rewardDay, streak: rewardDay, reset: false, cycleComplete: rewardDay === DAILY_FREE_REWARD_SCHEDULE.length };
  }

  const latest = transactions[0];
  if (!latest) return { claimed: false, rewardDay: 1, streak: 0, reset: false, cycleComplete: false };

  const previousRewardDay = rewardDayFor(latest);
  if (latest.referenceId === dayBefore(claimDay)) {
    const cycleComplete = previousRewardDay === DAILY_FREE_REWARD_SCHEDULE.length;
    return {
      claimed: false,
      rewardDay: cycleComplete ? 1 : previousRewardDay + 1,
      streak: previousRewardDay,
      reset: false,
      cycleComplete,
    };
  }

  return { claimed: false, rewardDay: 1, streak: 0, reset: true, cycleComplete: false };
}

export async function applyLedger(input: LedgerInput) {
  const existing = await ledgerRepository.findByIdempotency(input.idempotencyKey, input.session);
  if (existing) return existing;

  await userRepository.normalizeLegacyLastMatchPlayed(
    input.userId,
    input.session,
  );
  const user = await userRepository.findById(input.userId, input.session);
  if (!user) throw new AppError("User not found.", "USER_NOT_FOUND", 404);

  // Persist normalized values so repeated fractional credits/debits never
  // accumulate JavaScript floating-point artifacts (for example 0.1 + 0.2).
  const available = roundTokens(user.availableCoins + input.availableDelta);
  const locked = roundTokens(user.lockedCoins + input.lockedDelta);
  if (available < 0 || locked < 0) {
    throw new AppError("Insufficient NV Tokens for match registration.", "INSUFFICIENT_FUNDS");
  }

  user.availableCoins = available;
  user.lockedCoins = locked;
  await user.save({ session: input.session });

  return ledgerRepository.create(
    {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      availableAfter: available,
      lockedAfter: locked,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      accountEmail: input.accountEmail,
      metadata: input.metadata,
    },
    input.session,
  );
}

export async function getDailyFreeRewardStatus(userId: string, date = new Date()) {
  await connectDb();
  const claimDay = getRewardClaimDay(date);
  const transactions = await ledgerRepository.listDailyRewards(userId);
  return { claimDay, ...getNextDailyReward(transactions, claimDay) };
}

/**
 * Credits the user's server-derived reward for the day. The deterministic key
 * and database indexes enforce one claim per account per UTC calendar day.
 */
export async function claimDailyFreeReward(userId: string, date = new Date()) {
  const claimDay = getRewardClaimDay(date);
  const idempotencyKey = dailyRewardIdempotencyKey(userId, claimDay);

  try {
    return await withTransaction(async (session) => {
      const existing = await ledgerRepository.findByIdempotency(idempotencyKey, session);
      if (existing) {
        const rewardDay = rewardDayFor(existing);
        return { transaction: existing, claimedNow: false, claimDay, rewardDay, amount: existing.amount };
      }

      // Resolve the authenticated account from the database. Display name,
      // IGN, and UID are profile data and never participate in eligibility.
      const account = await userRepository.findById(userId, session);
      if (!account) throw new AppError("User not found.", "USER_NOT_FOUND", 404);
      const accountEmail = account.email.toLowerCase();
      const transactions = await ledgerRepository.listDailyRewards(userId, session);
      const reward = getNextDailyReward(transactions, claimDay);
      // A second lookup by date protects callers that do not use our
      // deterministic key, while the transaction keeps streak advancement
      // and the wallet credit in one atomic commit.
      if (reward.claimed) {
        const transaction = await ledgerRepository.findDailyReward(userId, claimDay, session);
        if (transaction) {
          const rewardDay = rewardDayFor(transaction);
          return { transaction, claimedNow: false, claimDay, rewardDay, amount: transaction.amount };
        }
      }
      const amount = DAILY_FREE_REWARD_SCHEDULE[reward.rewardDay - 1];

      const transaction = await applyLedger({
        userId,
        type: CoinTxnType.DAILY_FREE_REWARD,
        amount,
        availableDelta: amount,
        lockedDelta: 0,
        referenceType: "daily_free_reward",
        referenceId: claimDay,
        idempotencyKey,
        accountEmail,
        metadata: {
          claimDay,
          rewardAmount: amount,
          rewardDay: reward.rewardDay,
          referenceKey: idempotencyKey,
          accountEmail,
        },
        session,
      });
      return { transaction, claimedNow: true, claimDay, rewardDay: reward.rewardDay, amount };
    });
  } catch (error) {
    // A concurrent winner may have committed between our read and write. In
    // that case, return its immutable ledger record as the idempotent result.
    if ((error as { code?: number }).code === 11000) {
      const existing = await ledgerRepository.findByIdempotency(idempotencyKey);
      if (existing) {
        const rewardDay = rewardDayFor(existing);
        return { transaction: existing, claimedNow: false, claimDay, rewardDay, amount: existing.amount };
      }
    }
    throw error;
  }
}

export async function getOrCreatePlatformUser(session?: mongoose.ClientSession) {
  const existing = await userRepository.findPlatform(session);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  return userRepository.create(
    {
      email: "platform@ninzoversus.internal",
      passwordHash,
      displayName: "Ninzo Versus Platform",
      role: UserRole.PLATFORM,
      availableCoins: 0,
      lockedCoins: 0,
    },
    session,
  );
}

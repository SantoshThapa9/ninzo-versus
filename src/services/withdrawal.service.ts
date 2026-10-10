import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { todayUtcStart } from "@/lib/utils";
import { isValidTokenAmount } from "@/lib/utils";
import {
  withdrawalRepository,
} from "@/repositories/finance.repository";
import { userRepository } from "@/repositories/user.repository";
import { applyLedger } from "@/services/wallet.service";
import { auditRepository } from "@/repositories/ops.repository";
import { CoinTxnType, WithdrawalStatus } from "@/types/enums";
import { WithdrawalModel } from "@/models/withdrawal";
import { formatTokenActivity } from "@/lib/token-activity";
import mongoose from "mongoose";
import { upiIdSchema } from "@/services/upi.service";
import { ECONOMY_DEFAULTS } from "@/config/defaults";
import { tokenActivityAuditRepository } from "@/repositories/token-activity-audit.repository";

const requestSchema = z.object({
  coins: z.number().positive().refine(isValidTokenAmount, {
    message: "NV Tokens can have up to two decimal places.",
  }),
  upiId: upiIdSchema,
});

export async function requestWithdrawal(userId: string, raw: unknown) {
  const input = requestSchema.parse(raw);
  const settings = ECONOMY_DEFAULTS;
  if (input.coins < settings.minWithdrawalCoins) {
    throw new AppError(
      `Minimum reward redemption is ${settings.minWithdrawalCoins} NV Tokens.`,
      "MIN_WITHDRAWAL",
    );
  }

  await connectDb();
  return withTransaction(async (session) => {
    const user = await userRepository.findById(userId, session);
    if (!user) throw new AppError("User not found.", "NOT_FOUND", 404);
    if (user.age === undefined || user.age < 18) {
      throw new AppError(
        "UPI withdrawals are available only to users 18 or older.",
        "AGE_REQUIREMENT",
      );
    }
    if (user.lastWithdrawalAt && user.lastWithdrawalAt >= todayUtcStart()) {
      throw new AppError(
        "Only one reward redemption request is allowed per day.",
        "DAILY_LIMIT",
      );
    }

    if (user.upiId !== input.upiId) {
      throw new AppError(
        "Use the UPI ID saved in your profile for reward redemption.",
        "UPI_ID_MISMATCH",
      );
    }

    const withdrawal = await withdrawalRepository.create(
      {
        userId,
        coins: input.coins,
        feePercent: settings.withdrawalFeePercent,
        upiId: input.upiId,
      },
      session,
    );

    await applyLedger({
      userId,
      type: CoinTxnType.WITHDRAWAL,
      amount: -input.coins,
      availableDelta: -input.coins,
      lockedDelta: 0,
      referenceType: "Withdrawal",
      referenceId: String(withdrawal._id),
      idempotencyKey: `withdrawal:${withdrawal._id}`,
      session,
    });
    user.lastWithdrawalAt = new Date();
    user.lastWithdrawalAt = new Date();
    await user.save({ session });
    return withdrawal;
  });
}

export async function reviewWithdrawal(
  adminId: string,
  withdrawalId: string,
  action: "approve" | "reject" | "paid",
  note?: string,
) {
  await connectDb();
  const withdrawal = await withdrawalRepository.findById(withdrawalId);
  if (!withdrawal)
    throw new AppError(
      "Reward redemption request not found.",
      "NOT_FOUND",
      404,
    );

  if (action === "reject") {
    await withTransaction(async (session) => {
      const fresh = await withdrawalRepository.findById(withdrawalId, session);
      if (!fresh || fresh.status !== WithdrawalStatus.PENDING) {
        throw new AppError(
          "Reward redemption request cannot be declined.",
          "INVALID_STATUS",
        );
      }
      fresh.status = WithdrawalStatus.REJECTED;
      fresh.adminNote = note;
      fresh.processedBy = adminId as unknown as typeof fresh.processedBy;
      fresh.processedAt = new Date();
      await fresh.save({ session });
      await applyLedger({
        userId: String(fresh.userId),
        type: CoinTxnType.WITHDRAWAL_REVERSAL,
        amount: fresh.coins,
        availableDelta: fresh.coins,
        lockedDelta: 0,
        referenceType: "Withdrawal",
        referenceId: withdrawalId,
        idempotencyKey: `withdrawal-reversal:${withdrawalId}`,
        session,
      });
    });
  } else if (action === "approve") {
    withdrawal.status = WithdrawalStatus.APPROVED;
    withdrawal.adminNote = note;
    withdrawal.processedBy =
      adminId as unknown as typeof withdrawal.processedBy;
    await withdrawal.save();
  } else {
    withdrawal.status = WithdrawalStatus.PAID;
    withdrawal.adminNote = note;
    withdrawal.processedAt = new Date();
    withdrawal.processedBy =
      adminId as unknown as typeof withdrawal.processedBy;
    await withdrawal.save();
  }

  await auditRepository.write({
    actorId: adminId,
    action: `withdrawal.${action}`,
    entityType: "Withdrawal",
    entityId: withdrawalId,
    metadata: { note },
  });
}

export async function listWithdrawals(userId?: string) {
  await connectDb();
  if (userId) return withdrawalRepository.listForUser(userId);
  return WithdrawalModel.find().sort({ createdAt: -1 }).limit(80).lean();
}

type TokenFlowCursor = { createdAt: string; id: string };
const TOKEN_AUDIT_PAGE_SIZE = 20;

function parseTokenFlowCursor(cursor?: string): TokenFlowCursor | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as TokenFlowCursor;
    if (
      !value.createdAt ||
      !mongoose.isObjectIdOrHexString(value.id) ||
      Number.isNaN(new Date(value.createdAt).getTime())
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

function serializeTokenFlow(
  transactions: Awaited<ReturnType<typeof tokenActivityAuditRepository.listThroughWithdrawal>>,
) {
  return transactions.map((transaction) => ({
    id: String(transaction._id),
    label: formatTokenActivity(transaction.type, transaction.matchOutcome),
    amount: transaction.amount,
    availableDelta: transaction.availableDelta,
    lockedDelta: transaction.lockedDelta,
    availableBefore: transaction.availableBefore,
    lockedBefore: transaction.lockedBefore,
    availableAfter: transaction.availableAfter,
    lockedAfter: transaction.lockedAfter,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    matchOutcome: transaction.matchOutcome ?? null,
    createdAt: transaction.createdAt.toISOString(),
  }));
}

function nextTokenFlowCursor(transaction: { _id: unknown; createdAt: Date }) {
  return Buffer.from(
    JSON.stringify({
      id: String(transaction._id),
      createdAt: transaction.createdAt.toISOString(),
    }),
  ).toString("base64url");
}

export async function getWithdrawalTokenFlow(
  withdrawalId: string,
  cursor?: string,
) {
  await connectDb();
  const withdrawal = await withdrawalRepository.findById(withdrawalId);
  if (!withdrawal)
    throw new AppError(
      "Reward redemption request not found.",
      "NOT_FOUND",
      404,
    );
  const parsedCursor = parseTokenFlowCursor(cursor);
  const userId = String(withdrawal.userId);
  const requestAudit = await tokenActivityAuditRepository.findWithdrawalRequest(
    userId,
    withdrawalId,
  );
  const target = requestAudit
    ? { id: String(requestAudit._id), createdAt: requestAudit.createdAt }
    : {
        id: "ffffffffffffffffffffffff",
        createdAt: withdrawal.createdAt,
      };
  const [zeroBalanceReset, previousWithdrawals] = await Promise.all([
    tokenActivityAuditRepository.findLatestZeroBalanceBefore(userId, target),
    tokenActivityAuditRepository.listWithdrawalsThrough(userId, withdrawal.createdAt),
  ]);
  const historyBoundary = zeroBalanceReset
    ? { id: String(zeroBalanceReset._id), createdAt: zeroBalanceReset.createdAt }
    : null;
  const pageTransactions = await tokenActivityAuditRepository.listThroughWithdrawal(
    userId,
    target,
    historyBoundary,
    parsedCursor
      ? { id: parsedCursor.id, createdAt: new Date(parsedCursor.createdAt) }
      : undefined,
    TOKEN_AUDIT_PAGE_SIZE + 1,
  );
  const hasMore = pageTransactions.length > TOKEN_AUDIT_PAGE_SIZE;
  const visibleTransactions = pageTransactions.slice(0, TOKEN_AUDIT_PAGE_SIZE);
  return {
    transactions: serializeTokenFlow(visibleTransactions),
    nextCursor: hasMore
      ? nextTokenFlowCursor(visibleTransactions[visibleTransactions.length - 1])
      : null,
    withdrawalSnapshot: requestAudit?.withdrawalSnapshot ?? null,
    previousWithdrawals: previousWithdrawals.map((item) => ({
      id: String(item._id),
      amount: item.coins,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      processedAt: item.processedAt?.toISOString() ?? null,
      current: String(item._id) === withdrawalId,
    })),
    resetAt: historyBoundary?.createdAt.toISOString() ?? null,
  };
}

/** Admin review data is derived from the permanent wallet audit collection. */
export async function listWithdrawalReviews() {
  await connectDb();
  const withdrawals = await WithdrawalModel.find()
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();
  const userIds = [
    ...new Set(withdrawals.map((withdrawal) => String(withdrawal.userId))),
  ];
  const [users, histories] = await Promise.all([
    userRepository.findByIds(userIds),
    Promise.all(
      withdrawals.map(async (withdrawal) => [
        String(withdrawal._id),
        await getWithdrawalTokenFlow(String(withdrawal._id)),
      ] as const),
    ),
  ]);
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const historiesByWithdrawalId = new Map(histories);

  return withdrawals.map((withdrawal) => {
    const history = historiesByWithdrawalId.get(String(withdrawal._id));
    const user = usersById.get(String(withdrawal.userId));
    return {
      withdrawal,
      user: user
        ? {
            displayName: user.displayName,
            email: user.email,
            availableCoins: user.availableCoins,
            lockedCoins: user.lockedCoins,
          }
        : null,
      history,
    };
  });
}

import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { todayUtcStart } from "@/lib/utils";
import { isValidTokenAmount } from "@/lib/utils";
import { withdrawalRepository } from "@/repositories/finance.repository";
import { userRepository } from "@/repositories/user.repository";
import { applyLedger } from "@/services/wallet.service";
import { getPlatformSettings } from "@/services/settings.service";
import { auditRepository } from "@/repositories/ops.repository";
import { CoinTxnType, WithdrawalStatus } from "@/types/enums";
import { WithdrawalModel } from "@/models/withdrawal";

const requestSchema = z.object({
  coins: z.number().positive().refine(isValidTokenAmount, {
    message: "NV Tokens can have up to two decimal places.",
  }),
  upiId: z.string().min(5),
});

export async function requestWithdrawal(userId: string, raw: unknown) {
  const input = requestSchema.parse(raw);
  const settings = await getPlatformSettings();
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
    if (user.lastWithdrawalAt && user.lastWithdrawalAt >= todayUtcStart()) {
      throw new AppError("Only one reward redemption request is allowed per day.", "DAILY_LIMIT");
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
    user.upiId = input.upiId;
    await user.save({ session });
    return withdrawal;
  });
}

export async function reviewWithdrawal(
  adminId: string,
  withdrawalId: string,
  action: "approve" | "reject" | "paid",
  note?: string,
  utr?: string,
) {
  await connectDb();
  const withdrawal = await withdrawalRepository.findById(withdrawalId);
  if (!withdrawal) throw new AppError("Reward redemption request not found.", "NOT_FOUND", 404);

  if (action === "reject") {
    await withTransaction(async (session) => {
      const fresh = await withdrawalRepository.findById(withdrawalId, session);
      if (!fresh || fresh.status !== WithdrawalStatus.PENDING) {
        throw new AppError("Reward redemption request cannot be declined.", "INVALID_STATUS");
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
    withdrawal.processedBy = adminId as unknown as typeof withdrawal.processedBy;
    await withdrawal.save();
  } else {
    withdrawal.status = WithdrawalStatus.PAID;
    withdrawal.utr = utr;
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = adminId as unknown as typeof withdrawal.processedBy;
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

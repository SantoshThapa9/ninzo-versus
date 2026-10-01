import mongoose from "mongoose";
import { CoinTransactionModel } from "@/models/coin-transaction";
import { PaymentModel } from "@/models/payment";
import { WithdrawalModel } from "@/models/withdrawal";
import type { CoinTxnType } from "@/types/enums";

type Session = mongoose.ClientSession;
type LedgerCursor = { createdAt: Date; id: string };

export const ledgerRepository = {
  findByIdempotency(key: string, session?: Session) {
    return CoinTransactionModel.findOne({ idempotencyKey: key }).session(session ?? null);
  },
  findDailyReward(userId: string, claimDay: string, session?: Session) {
    return CoinTransactionModel.findOne({
      userId,
      type: "daily_free_reward",
      referenceType: "daily_free_reward",
      referenceId: claimDay,
    }).session(session ?? null);
  },
  listDailyRewards(userId: string, session?: Session) {
    return CoinTransactionModel.find({
      userId,
      type: "daily_free_reward",
      referenceType: "daily_free_reward",
    })
      .sort({ referenceId: -1 })
      .limit(2)
      .session(session ?? null);
  },
  create(
    data: {
      userId: string;
      type: CoinTxnType;
      amount: number;
      availableAfter: number;
      lockedAfter: number;
      referenceType: string;
      referenceId: string;
      idempotencyKey: string;
      accountEmail?: string;
      metadata?: unknown;
    },
    session?: Session,
  ) {
    return CoinTransactionModel.create([data], { session }).then((docs) => docs[0]);
  },
  listForUser(userId: string, limit = 40) {
    return CoinTransactionModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  },
  listForUserPage(userId: string, cursor?: LedgerCursor, limit = 10) {
    const filter: Record<string, unknown> = { userId };
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
      ];
    }
    return CoinTransactionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  },
};

export const paymentRepository = {
  create(
    data: {
      userId: string;
      coins: number;
      amountPaise: number;
      feePaise: number;
      razorpayOrderId: string;
      idempotencyKey: string;
    },
    session?: Session,
  ) {
    return PaymentModel.create([data], { session }).then((docs) => docs[0]);
  },
  findByOrderId(orderId: string, session?: Session) {
    return PaymentModel.findOne({ razorpayOrderId: orderId }).session(session ?? null);
  },
};

export const withdrawalRepository = {
  create(
    data: { userId: string; coins: number; feePercent: number; upiId: string },
    session?: Session,
  ) {
    return WithdrawalModel.create([data], { session }).then((docs) => docs[0]);
  },
  findById(id: string, session?: Session) {
    return WithdrawalModel.findById(id).session(session ?? null);
  },
  listPending() {
    return WithdrawalModel.find({ status: "pending" }).sort({ createdAt: 1 }).lean();
  },
  listForUser(userId: string) {
    return WithdrawalModel.find({ userId }).sort({ createdAt: -1 }).lean();
  },
};

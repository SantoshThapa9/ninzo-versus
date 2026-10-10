import mongoose from "mongoose";
import {
  CoinTransactionIdempotencyKeyModel,
  CoinTransactionModel,
} from "@/models/coin-transaction";
import { PaymentModel } from "@/models/payment";
import { WithdrawalModel } from "@/models/withdrawal";
import type { CoinTxnType } from "@/types/enums";

type Session = mongoose.ClientSession;
type LedgerCursor = { createdAt: Date; id: string };
const LEGACY_IDEMPOTENCY_COLLECTION = "coin_transaction_idempotency";

function findLegacyIdempotency(filter: Record<string, unknown>, session?: Session) {
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB must be connected before checking legacy idempotency.");
  return database
    .collection(LEGACY_IDEMPOTENCY_COLLECTION)
    .findOne(filter, session ? { session } : undefined);
}

function idempotencyMarker(transaction: {
  userId: mongoose.Types.ObjectId;
  type: CoinTxnType;
  amount: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadata?: unknown;
}) {
  if (transaction.referenceType !== "daily_free_reward") {
    return { idempotencyKey: transaction.idempotencyKey };
  }

  const rewardDay = (transaction.metadata as { rewardDay?: unknown } | undefined)?.rewardDay;
  return {
    idempotencyKey: transaction.idempotencyKey,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
    ...(typeof rewardDay === "number" ? { metadata: { rewardDay } } : {}),
  };
}

export const ledgerRepository = {
  async findByIdempotency(key: string, session?: Session) {
    const idempotencyKey = await CoinTransactionIdempotencyKeyModel.findOne({ idempotencyKey: key })
      .session(session ?? null);
    if (idempotencyKey) return idempotencyKey;

    const activeTransaction = await CoinTransactionModel.findOne({ idempotencyKey: key })
      .session(session ?? null);
    if (activeTransaction) return activeTransaction;

    return findLegacyIdempotency({ idempotencyKey: key }, session);
  },
  async findDailyReward(userId: string, claimDay: string, session?: Session) {
    const filter = {
      userId,
      type: "daily_free_reward",
      referenceType: "daily_free_reward",
      referenceId: claimDay,
    };
    const idempotencyKey = await CoinTransactionIdempotencyKeyModel.findOne(filter)
      .session(session ?? null);
    if (idempotencyKey) return idempotencyKey;

    const activeTransaction = await CoinTransactionModel.findOne(filter).session(session ?? null);
    if (activeTransaction) return activeTransaction;

    return findLegacyIdempotency(
      { ...filter, userId: new mongoose.Types.ObjectId(userId) },
      session,
    );
  },
  listDailyRewards(userId: string, session?: Session) {
    return CoinTransactionModel.find({
      userId,
      type: "daily_free_reward",
      referenceType: "daily_free_reward",
    })
      .sort({ referenceId: -1 })
      .limit(2)
      .maxTimeMS(8_000)
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
  recordIdempotency(transaction: {
    userId: mongoose.Types.ObjectId;
    type: CoinTxnType;
    amount: number;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    metadata?: unknown;
  }, session: Session) {
    return CoinTransactionIdempotencyKeyModel.create(
      [idempotencyMarker(transaction)],
      { session },
    ).then((docs) => docs[0]);
  },
  async deleteActivityForUser(userId: string, session: Session) {
    const transactions = await CoinTransactionModel.find({ userId })
      .select("userId type amount referenceType referenceId idempotencyKey metadata")
      .session(session);
    if (transactions.length === 0) return;

    await CoinTransactionIdempotencyKeyModel.bulkWrite(
      transactions.map((transaction) => ({
        updateOne: {
          filter: { idempotencyKey: transaction.idempotencyKey },
          update: { $setOnInsert: idempotencyMarker(transaction) },
          upsert: true,
        },
      })),
      { session },
    );
    const result = await CoinTransactionModel.deleteMany({ userId }, { session });
    if (result.deletedCount !== transactions.length) {
      throw new Error("Could not permanently delete the user's token activity.");
    }
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

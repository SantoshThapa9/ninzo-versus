import mongoose from "mongoose";
import { TokenActivityAuditModel } from "@/models/token-activity-audit";
import { WithdrawalModel } from "@/models/withdrawal";
import type { CoinTxnType } from "@/types/enums";

type Session = mongoose.ClientSession;

export type TokenActivityAuditInput = {
  transactionId: mongoose.Types.ObjectId;
  userId: string;
  type: CoinTxnType;
  amount: number;
  availableDelta: number;
  lockedDelta: number;
  availableBefore: number;
  lockedBefore: number;
  availableAfter: number;
  lockedAfter: number;
  referenceType: string;
  referenceId: string;
  matchOutcome?: "win" | "loss" | "draw";
  createdAt: Date;
  withdrawalSnapshot?: {
    requestedAmount: number;
    availableBeforeReservation: number;
    lockedBeforeReservation: number;
    totalBeforeReservation: number;
    availableAfterReservation: number;
    lockedAfterReservation: number;
    totalAfterReservation: number;
  };
};

export type AuditCursor = { createdAt: Date; id: string };

export const tokenActivityAuditRepository = {
  create(input: TokenActivityAuditInput, session: Session) {
    return TokenActivityAuditModel.create(
      [{ ...input, _id: input.transactionId }],
      { session },
    ).then((documents) => documents[0]);
  },
  findWithdrawalRequest(userId: string, withdrawalId: string) {
    return TokenActivityAuditModel.findOne({
      userId,
      type: "withdrawal",
      referenceType: "Withdrawal",
      referenceId: withdrawalId,
    }).lean();
  },
  findLatestZeroBalanceBefore(
    userId: string,
    target: AuditCursor,
  ) {
    return TokenActivityAuditModel.findOne({
      userId,
      availableAfter: 0,
      lockedAfter: 0,
      $or: [
        { createdAt: { $lt: target.createdAt } },
        { createdAt: target.createdAt, _id: { $lt: new mongoose.Types.ObjectId(target.id) } },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },
  listThroughWithdrawal(
    userId: string,
    target: AuditCursor,
    zeroBalanceReset: AuditCursor | null,
    cursor: AuditCursor | undefined,
    limit: number,
  ) {
    const clauses: Record<string, unknown>[] = [
      {
        $or: [
          { createdAt: { $lt: target.createdAt } },
          { createdAt: target.createdAt, _id: { $lte: new mongoose.Types.ObjectId(target.id) } },
        ],
      },
    ];
    if (zeroBalanceReset) {
      clauses.push({
        $or: [
          { createdAt: { $gt: zeroBalanceReset.createdAt } },
          {
            createdAt: zeroBalanceReset.createdAt,
            _id: { $gte: new mongoose.Types.ObjectId(zeroBalanceReset.id) },
          },
        ],
      });
    }
    if (cursor) {
      clauses.push({
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
        ],
      });
    }
    return TokenActivityAuditModel.find({ userId, $and: clauses })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  },
  listWithdrawalsThrough(userId: string, createdAt: Date) {
    return WithdrawalModel.find({ userId, createdAt: { $lte: createdAt } })
      .select("coins status createdAt processedAt")
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },
};

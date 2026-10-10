import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { CoinTxnType } from "@/types/enums";

const WithdrawalSnapshotSchema = new Schema(
  {
    requestedAmount: { type: Number, required: true },
    availableBeforeReservation: { type: Number, required: true },
    lockedBeforeReservation: { type: Number, required: true },
    totalBeforeReservation: { type: Number, required: true },
    availableAfterReservation: { type: Number, required: true },
    lockedAfterReservation: { type: Number, required: true },
    totalAfterReservation: { type: Number, required: true },
  },
  { _id: false },
);

const TokenActivityAuditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: Object.values(CoinTxnType), required: true },
    amount: { type: Number, required: true },
    availableDelta: { type: Number, required: true },
    lockedDelta: { type: Number, required: true },
    availableBefore: { type: Number, required: true },
    lockedBefore: { type: Number, required: true },
    availableAfter: { type: Number, required: true },
    lockedAfter: { type: Number, required: true },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    matchOutcome: { type: String, enum: ["win", "loss", "draw"] },
    withdrawalSnapshot: { type: WithdrawalSnapshotSchema },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false },
);

TokenActivityAuditSchema.index(
  { userId: 1, transactionId: 1 },
  { unique: true },
);
TokenActivityAuditSchema.index({ userId: 1, createdAt: -1, _id: -1 });
TokenActivityAuditSchema.index({
  userId: 1,
  referenceType: 1,
  referenceId: 1,
});
TokenActivityAuditSchema.index({
  userId: 1,
  availableAfter: 1,
  lockedAfter: 1,
  createdAt: -1,
  _id: -1,
});

export type TokenActivityAuditDoc =
  InferSchemaType<typeof TokenActivityAuditSchema> & { _id: Types.ObjectId };

export const TokenActivityAuditModel =
  models.TokenActivityAudit || model("TokenActivityAudit", TokenActivityAuditSchema);

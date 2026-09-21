import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { CoinTxnType } from "@/types/enums";

const CoinTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(CoinTxnType), required: true },
    amount: { type: Number, required: true },
    availableAfter: { type: Number, required: true },
    lockedAfter: { type: Number, required: true },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

CoinTransactionSchema.index({ userId: 1, createdAt: -1 });

export type CoinTransactionDoc = InferSchemaType<typeof CoinTransactionSchema> & {
  _id: Types.ObjectId;
};

export const CoinTransactionModel =
  models.CoinTransaction || model("CoinTransaction", CoinTransactionSchema);

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
    // Present for daily rewards so their account-level eligibility is
    // independently auditable without relying on profile fields.
    accountEmail: { type: String, lowercase: true, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

CoinTransactionSchema.index({ userId: 1, createdAt: -1 });
// A second database-level guard prevents a duplicate daily reward even if a
// future caller accidentally supplies a different idempotency key.
CoinTransactionSchema.index(
  { userId: 1, referenceType: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceType: "daily_free_reward" },
  },
);
CoinTransactionSchema.index(
  { accountEmail: 1, referenceType: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referenceType: "daily_free_reward",
      accountEmail: { $type: "string" },
    },
  },
);

export type CoinTransactionDoc = InferSchemaType<typeof CoinTransactionSchema> & {
  _id: Types.ObjectId;
};

const cachedCoinTransactionModel = models.CoinTransaction;

// Next.js dev reloads preserve Mongoose models. Extend the cached schema so a
// newly added ledger type cannot be rejected by the old enum during reload.
if (cachedCoinTransactionModel) {
  const transactionType = cachedCoinTransactionModel.schema.path("type") as unknown as {
    enum: (...values: string[]) => void;
    enumValues?: string[];
  };
  if (!transactionType.enumValues?.includes(CoinTxnType.DAILY_FREE_REWARD)) {
    transactionType.enum(CoinTxnType.DAILY_FREE_REWARD);
  }
  if (!cachedCoinTransactionModel.schema.path("accountEmail")) {
    cachedCoinTransactionModel.schema.add({
      accountEmail: { type: String, lowercase: true, trim: true },
    });
  }
}

export const CoinTransactionModel =
  cachedCoinTransactionModel || model("CoinTransaction", CoinTransactionSchema);

import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { WithdrawalStatus } from "@/types/enums";

const WithdrawalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coins: { type: Number, required: true, min: 0.01 },
    feePercent: { type: Number, required: true, default: 0 },
    upiId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.PENDING,
    },
    adminNote: { type: String },
    utr: { type: String, select: false },
    processedBy: { type: Schema.Types.ObjectId, ref: "User" },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

WithdrawalSchema.index({ userId: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1, createdAt: -1 });

export type WithdrawalDoc = InferSchemaType<typeof WithdrawalSchema> & {
  _id: Types.ObjectId;
};

export const WithdrawalModel = models.Withdrawal || model("Withdrawal", WithdrawalSchema);

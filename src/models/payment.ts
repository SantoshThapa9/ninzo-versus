import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { PaymentStatus } from "@/types/enums";

const PaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coins: { type: Number, required: true, min: 1 },
    amountPaise: { type: Number, required: true, min: 1 },
    feePaise: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.CREATED },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: Types.ObjectId };

export const PaymentModel = models.Payment || model("Payment", PaymentSchema);

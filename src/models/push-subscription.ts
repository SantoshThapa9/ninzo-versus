import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true },
);

PushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

export type PushSubscriptionDoc = InferSchemaType<typeof PushSubscriptionSchema> & {
  _id: Types.ObjectId;
};

export const PushSubscriptionModel =
  models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);

import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const MatchChatMessageSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

MatchChatMessageSchema.index({ matchId: 1, createdAt: 1 });
MatchChatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type MatchChatMessageDoc = InferSchemaType<typeof MatchChatMessageSchema> & { _id: Types.ObjectId };

export const MatchChatMessageModel =
  models.MatchChatMessage || model("MatchChatMessage", MatchChatMessageSchema);

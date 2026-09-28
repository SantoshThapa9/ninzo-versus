import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

// This is intentionally separate from Match. Match history is pruned after a
// few days, while a room ID must remain unavailable for future evidence checks.
const VerifiedRoomIdSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, trim: true },
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
  },
  { timestamps: true },
);

export type VerifiedRoomIdDoc = InferSchemaType<typeof VerifiedRoomIdSchema> & {
  _id: Types.ObjectId;
};

export const VerifiedRoomIdModel =
  models.VerifiedRoomId ||
  model("VerifiedRoomId", VerifiedRoomIdSchema);

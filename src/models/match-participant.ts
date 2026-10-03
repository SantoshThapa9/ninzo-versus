import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const MatchParticipantSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    team: { type: String, enum: ["A", "B"], required: true },
    ign: { type: String, required: true, trim: true },
    isCaptain: { type: Boolean, default: false },
    lockAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

MatchParticipantSchema.index({ matchId: 1, userId: 1 }, { unique: true });
// Supports the daily stats job's "did this user play yesterday?" lookup.
MatchParticipantSchema.index({ userId: 1, matchId: 1 });

export type MatchParticipantDoc = InferSchemaType<typeof MatchParticipantSchema> & {
  _id: Types.ObjectId;
};

export const MatchParticipantModel =
  models.MatchParticipant || model("MatchParticipant", MatchParticipantSchema);

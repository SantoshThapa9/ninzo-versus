import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const MatchEvidenceAttemptSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
  },
  { timestamps: true },
);

// Attempt checks filter by match and user; no caller sorts these records.
MatchEvidenceAttemptSchema.index({ matchId: 1, userId: 1 });

export type MatchEvidenceAttemptDoc =
  InferSchemaType<typeof MatchEvidenceAttemptSchema> & { _id: Types.ObjectId };

export const MatchEvidenceAttemptModel =
  models.MatchEvidenceAttempt ||
  model("MatchEvidenceAttempt", MatchEvidenceAttemptSchema);

import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { MatchStatus } from "@/types/enums";

const MatchSchema = new Schema(
  {
    format: { type: Number, required: true, min: 1, max: 6 },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    opponentCaptainId: { type: Schema.Types.ObjectId, ref: "User" },
    creatorIgn: { type: String, required: true, trim: true },
    rules: { type: String, required: true },
    stakeMin: { type: Number, required: true, min: 1 },
    stakeMax: { type: Number, required: true, min: 1 },
    lockedStake: { type: Number, required: true, min: 0 },
    acceptedStake: { type: Number, min: 0 },
    platformFeePercent: { type: Number, required: true },
    prizePool: { type: Number, default: 0 },
    winnerPayout: { type: Number, default: 0 },
    platformFeeAmount: { type: Number, default: 0 },
    winnerTeam: { type: String, enum: ["A", "B", null], default: null },
    provisionalResult: { type: String, enum: ["WIN", "LOSS", "HOLD", null], default: null },
    status: { type: String, enum: Object.values(MatchStatus), default: MatchStatus.OPEN },
    completedAt: { type: Date },
    roomId: { type: String, select: false },
    roomPassword: { type: String, select: false },
    chatExpiresAt: { type: Date },
    completedBy: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    aiAnalysisStartedAt: { type: Date },
    aiWinnerRecommendation: { type: String },
    aiAnalysis: { type: Schema.Types.Mixed },
    warningAcknowledgedAt: { type: Date },
  },
  { timestamps: true },
);

MatchSchema.index({ status: 1, createdAt: -1 });
MatchSchema.index({ creatorId: 1, status: 1 });

export type MatchDoc = InferSchemaType<typeof MatchSchema> & { _id: Types.ObjectId };

export const MatchModel = models.Match || model("Match", MatchSchema);

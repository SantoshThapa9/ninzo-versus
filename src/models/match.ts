import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { ECONOMY_DEFAULTS } from "@/config/defaults";
import { EVENT_ROUNDS, MatchStatus } from "@/types/enums";

const evidenceFailuresField = {
  type: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      count: { type: Number, required: true, default: 0, min: 0 },
    },
  ],
  default: [],
};

const chatNotificationMutedByField = {
  type: [{ type: Schema.Types.ObjectId, ref: "User" }],
  default: [],
};

const MatchSchema = new Schema(
  {
    format: { type: Number, required: true, min: 1, max: 6 },
    rounds: { type: Number, required: true, enum: [...EVENT_ROUNDS], default: 7 },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    opponentCaptainId: { type: Schema.Types.ObjectId, ref: "User" },
    creatorIgn: { type: String, required: true, trim: true },
    rules: { type: String, required: true },
    // Persist the same minimum enforced by the challenge form and service.
    // A hard-coded `1` here rejected valid 0.01-token stakes after Zod had
    // accepted them, surfacing as the generic validation error in the action.
    stakeMin: {
      type: Number,
      required: true,
      min: ECONOMY_DEFAULTS.minMatchStakeCoins,
    },
    stakeMax: {
      type: Number,
      required: true,
      min: ECONOMY_DEFAULTS.minMatchStakeCoins,
    },
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
    // Per-player preference for this private chat only. It never affects the
    // user's platform-wide push subscription or other Clash conversations.
    chatNotificationMutedBy: chatNotificationMutedByField,
    completedBy: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    aiAnalysisStartedAt: { type: Date },
    aiWinnerRecommendation: { type: String },
    aiAnalysis: { type: Schema.Types.Mixed },
    evidenceFailures: evidenceFailuresField,
    warningAcknowledgedAt: { type: Date },
  },
  { timestamps: true },
);

MatchSchema.index({ status: 1, createdAt: -1 });
MatchSchema.index({ creatorId: 1, status: 1 });
MatchSchema.index({ seasonId: 1, status: 1, completedAt: -1 });

export type MatchDoc = InferSchemaType<typeof MatchSchema> & { _id: Types.ObjectId };

// Next.js development hot reload reuses Mongoose models. Add fields introduced
// during a reload to that cached schema too, otherwise Mongoose silently strips
// the new field from updates and the retry count appears to reset on refresh.
const cachedMatchModel = models.Match;
if (cachedMatchModel) {
  if (!cachedMatchModel.schema.path("evidenceFailures")) {
    cachedMatchModel.schema.add({ evidenceFailures: evidenceFailuresField });
  }
  if (!cachedMatchModel.schema.path("seasonId")) {
    cachedMatchModel.schema.add({
      seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    });
  }
  if (!cachedMatchModel.schema.path("rounds")) {
    cachedMatchModel.schema.add({
      rounds: { type: Number, required: true, enum: [...EVENT_ROUNDS], default: 7 },
    });
  }
  if (!cachedMatchModel.schema.path("chatNotificationMutedBy")) {
    cachedMatchModel.schema.add({
      chatNotificationMutedBy: chatNotificationMutedByField,
    });
  }
  for (const field of ["stakeMin", "stakeMax"] as const) {
    const stakePath =
      cachedMatchModel.schema.path<Schema.Types.Number>(field);
    if (stakePath.options.min !== ECONOMY_DEFAULTS.minMatchStakeCoins) {
      stakePath.validators = stakePath.validators.filter(
        (validator) => validator.type !== "min",
      );
      stakePath.min(ECONOMY_DEFAULTS.minMatchStakeCoins);
    }
  }
}

export const MatchModel = cachedMatchModel || model("Match", MatchSchema);

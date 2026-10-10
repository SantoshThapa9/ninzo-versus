import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { EventFormat, EventStatus } from "@/types/enums";

const PrizeDistributionSchema = new Schema(
  {
    platformProfit: { type: Number, required: true, min: 0 },
    first: { type: Number, required: true, min: 0 },
    second: { type: Number, required: true, min: 0 },
    third: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const HostedEventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    eventDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    registrationOpensAt: { type: Date, required: true },
    registrationClosesAt: { type: Date, required: true },
    format: { type: String, enum: Object.values(EventFormat), required: true },
    maxSlots: { type: Number, required: true, min: 1 },
    reservedSlots: { type: Number, default: 0, min: 0 },
    entryFeeCoins: { type: Number, required: true, min: 0 },
    winningPrizeCoins: { type: Number, default: 0, min: 0 },
    prizeDistribution: { type: PrizeDistributionSchema, required: true },
    characterSkill: { type: Boolean, default: true },
    unlimitedGlooWall: { type: Boolean, default: false },
    roomRules: { type: String, default: "" },
    customNotes: { type: String, default: "" },
    roomId: { type: String, default: "" },
    roomPassword: { type: String, default: "" },
    status: { type: String, enum: Object.values(EventStatus), default: EventStatus.DRAFT },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

HostedEventSchema.index({ status: 1, eventDate: 1 });
HostedEventSchema.index({ status: 1, createdAt: -1 });
HostedEventSchema.index({ seasonId: 1, status: 1, eventDate: -1 });
// Drives the expired-occurrence scan without inspecting future/live events.
HostedEventSchema.index({ status: 1, registrationClosesAt: 1 });

export type HostedEventDoc = InferSchemaType<typeof HostedEventSchema> & {
  _id: Types.ObjectId;
};

// During development, Next.js can retain a previously compiled Mongoose model
// after a hot reload. Extend that cached schema as well so newly added event
// fields (such as the free-entry prize pool) are not silently discarded.
const existingHostedEventModel = models.HostedEvent;
if (existingHostedEventModel && !existingHostedEventModel.schema.path("winningPrizeCoins")) {
  existingHostedEventModel.schema.add({
    winningPrizeCoins: { type: Number, default: 0, min: 0 },
  });
}
if (existingHostedEventModel && !existingHostedEventModel.schema.path("seasonId")) {
  existingHostedEventModel.schema.add({
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
  });
}
export const HostedEventModel = existingHostedEventModel || model("HostedEvent", HostedEventSchema);

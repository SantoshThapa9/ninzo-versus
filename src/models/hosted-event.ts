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
    eventDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    registrationOpensAt: { type: Date, required: true },
    registrationClosesAt: { type: Date, required: true },
    format: { type: String, enum: Object.values(EventFormat), required: true },
    maxSlots: { type: Number, required: true, min: 1 },
    reservedSlots: { type: Number, default: 0, min: 0 },
    entryFeeCoins: { type: Number, required: true, min: 0 },
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

export type HostedEventDoc = InferSchemaType<typeof HostedEventSchema> & {
  _id: Types.ObjectId;
};

export const HostedEventModel = models.HostedEvent || model("HostedEvent", HostedEventSchema);

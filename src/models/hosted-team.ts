import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const HostedTeamSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "HostedEvent", required: true },
    captainId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    igns: { type: [String], required: true },
    slotNumber: { type: Number, required: true },
    paidCoins: { type: Number, required: true },
    placement: { type: Number },
  },
  { timestamps: true },
);

HostedTeamSchema.index({ eventId: 1, captainId: 1 }, { unique: true });
HostedTeamSchema.index({ eventId: 1, slotNumber: 1 }, { unique: true });

export type HostedTeamDoc = InferSchemaType<typeof HostedTeamSchema> & {
  _id: Types.ObjectId;
};

export const HostedTeamModel = models.HostedTeam || model("HostedTeam", HostedTeamSchema);

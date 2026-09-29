import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { ReportType } from "@/types/enums";

const DisputeSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match" },
    eventId: { type: Schema.Types.ObjectId, ref: "HostedEvent" },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(ReportType), required: true },
    freeFireUid: { type: String, trim: true },
    ign: { type: String, trim: true },
    description: { type: String, required: true },
    status: { type: String, default: "open" },
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket" },
  },
  { timestamps: true },
);

DisputeSchema.index({ status: 1, createdAt: -1 });

export type DisputeDoc = InferSchemaType<typeof DisputeSchema> & { _id: Types.ObjectId };

export const DisputeModel = models.Dispute || model("Dispute", DisputeSchema);

import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { ReportType, SupportStatus } from "@/types/enums";

const SupportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, enum: Object.values(ReportType), required: true },
    status: { type: String, enum: Object.values(SupportStatus), default: SupportStatus.AI_ACTIVE },
    matchId: { type: String, trim: true },
    freeFireUid: { type: String, trim: true },
    ign: { type: String, trim: true },
    summary: { type: String, required: true },
  },
  { timestamps: true },
);

SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, updatedAt: -1 });

export type SupportTicketDoc = InferSchemaType<typeof SupportTicketSchema> & {
  _id: Types.ObjectId;
};

export const SupportTicketModel =
  models.SupportTicket || model("SupportTicket", SupportTicketSchema);

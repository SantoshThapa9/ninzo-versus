import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { TicketSender } from "@/types/enums";

const SupportMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true },
    sender: { type: String, enum: Object.values(TicketSender), required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export type SupportMessageDoc = InferSchemaType<typeof SupportMessageSchema> & {
  _id: Types.ObjectId;
};

export const SupportMessageModel =
  models.SupportMessage || model("SupportMessage", SupportMessageSchema);

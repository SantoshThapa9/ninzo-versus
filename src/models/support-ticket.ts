import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { ReportType, SupportStatus } from "@/types/enums";

const categoryValues = Object.values(ReportType);

const SupportTicketSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Only manual reports are eligible for the admin support queue.
    source: { type: String, enum: ["manual"], required: true, default: "manual" },
    category: { type: String, enum: categoryValues, required: true },
    status: { type: String, enum: Object.values(SupportStatus), default: SupportStatus.AI_ACTIVE },
    matchId: { type: String, trim: true },
    ign: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    summary: { type: String, required: true },
    // Customers may attach screenshots only after an admin enables this for
    // the individual support request.
    allowUserImageUploads: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Both customer and admin inboxes order tickets by their most recent activity.
SupportTicketSchema.index({ userId: 1, updatedAt: -1 });
SupportTicketSchema.index({ status: 1, updatedAt: -1 });

export type SupportTicketDoc = InferSchemaType<typeof SupportTicketSchema> & {
  _id: Types.ObjectId;
};

const cachedCategoryValues = models.SupportTicket?.schema.path("category")?.options.enum as
  | string[]
  | undefined;

// Mongoose retains models between Next.js Fast Refreshes. Rebuild this model
// in development when its category enum changed, rather than validating a new
// form option against a stale schema.
if (
  process.env.NODE_ENV === "development" &&
  cachedCategoryValues &&
  !categoryValues.every((value) => cachedCategoryValues.includes(value))
) {
  delete models.SupportTicket;
}

// Add the new field to a development model retained through Fast Refresh.
if (models.SupportTicket && !models.SupportTicket.schema.path("allowUserImageUploads")) {
  models.SupportTicket.schema.add({
    allowUserImageUploads: { type: Boolean, default: false },
  });
}

export const SupportTicketModel =
  models.SupportTicket || model("SupportTicket", SupportTicketSchema);

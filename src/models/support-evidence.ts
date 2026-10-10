import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const SupportEvidenceSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mediaUrl: { type: String, required: true },
    blobPathname: { type: String, required: true },
    mimeType: { type: String, required: true },
    kind: { type: String, enum: ["image"], required: true },
    expiresAt: { type: Date },
    retainForDispute: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Kept until the Blob cleanup succeeds so failed Blob deletions can retry.
SupportEvidenceSchema.index({ expiresAt: 1 });
SupportEvidenceSchema.index({ ticketId: 1, createdAt: 1 });

export type SupportEvidenceDoc = InferSchemaType<typeof SupportEvidenceSchema> & {
  _id: Types.ObjectId;
};

export const SupportEvidenceModel =
  models.SupportEvidence || model("SupportEvidence", SupportEvidenceSchema);

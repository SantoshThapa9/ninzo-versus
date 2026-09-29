import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { EvidenceKind } from "@/types/enums";

const AiAnalysisSchema = new Schema(
  {
    roomId: String,
    winnerIGN: String,
    confidence: Number,
    raw: Schema.Types.Mixed,
  },
  { _id: false },
);

const ResultSubmissionSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: Object.values(EvidenceKind), required: true },
    mediaUrl: { type: String, required: true },
    blobPathname: { type: String, required: true },
    expiresAt: { type: Date },
    retainForDispute: { type: Boolean, default: false },
    aiAnalysis: AiAnalysisSchema,
  },
  { timestamps: true },
);

ResultSubmissionSchema.index({ matchId: 1, userId: 1, kind: 1 }, { unique: true });
// Used by the media-purge job; this is deliberately not a TTL index because
// Blob deletion must succeed before its record is removed.
ResultSubmissionSchema.index({ expiresAt: 1 });

export type ResultSubmissionDoc = InferSchemaType<typeof ResultSubmissionSchema> & {
  _id: Types.ObjectId;
};

export const ResultSubmissionModel =
  models.ResultSubmission || model("ResultSubmission", ResultSubmissionSchema);

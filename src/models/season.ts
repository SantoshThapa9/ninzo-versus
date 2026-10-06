import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const SeasonSchema = new Schema(
  {
    id: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "completed"], required: true },
    rankingsSnapshottedAt: { type: Date },
    rankingsSnapshotStartedAt: { type: Date },
  },
  { timestamps: true },
);

SeasonSchema.index({ startDate: -1 });

export type SeasonDoc = InferSchemaType<typeof SeasonSchema> & {
  _id: Types.ObjectId;
};

export const SeasonModel = models.Season || model("Season", SeasonSchema);

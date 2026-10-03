import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const ScheduledJobRunSchema = new Schema(
  {
    jobName: { type: String, required: true },
    day: { type: String, required: true },
  },
  { timestamps: true },
);

// The database, rather than an in-memory lock, is the idempotency authority
// when Vercel retries or delivers the same scheduled invocation more than once.
ScheduledJobRunSchema.index({ jobName: 1, day: 1 }, { unique: true });

export type ScheduledJobRunDoc = InferSchemaType<typeof ScheduledJobRunSchema> & {
  _id: Types.ObjectId;
};

export const ScheduledJobRunModel =
  models.ScheduledJobRun || model("ScheduledJobRun", ScheduledJobRunSchema);

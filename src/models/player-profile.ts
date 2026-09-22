import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const PlayerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    ign: { type: String, required: true, trim: true },
    uid: { type: String, trim: true },
    // This timestamp is only changed when either in-game identity field changes.
    identityUpdatedAt: { type: Date },
  },
  { timestamps: true },
);

export type PlayerProfileDoc = InferSchemaType<typeof PlayerProfileSchema> & {
  _id: Types.ObjectId;
};

export const PlayerProfileModel =
  models.PlayerProfile || model("PlayerProfile", PlayerProfileSchema);

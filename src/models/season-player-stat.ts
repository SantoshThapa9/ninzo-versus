import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const SeasonPlayerStatSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", required: true },
    matchesPlayed: { type: Number, required: true, default: 0, min: 0 },
    settledMatchesPlayed: { type: Number, required: true, default: 0, min: 0 },
    inactivityMatchesPlayed: { type: Number, required: true, default: 0, min: 0 },
    wins: { type: Number, required: true, default: 0, min: 0 },
    displayName: { type: String },
    ign: { type: String },
    legacySnapshot: { type: Boolean, default: false },
    dailyMatchesPlayedIncrementDay: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
  },
  { timestamps: true },
);

SeasonPlayerStatSchema.index({ seasonId: 1, wins: -1, matchesPlayed: -1 });

export type SeasonPlayerStatDoc = InferSchemaType<
  typeof SeasonPlayerStatSchema
> & { _id: string; userId: Types.ObjectId; seasonId: Types.ObjectId };

export const SeasonPlayerStatModel =
  models.SeasonPlayerStat ||
  model("SeasonPlayerStat", SeasonPlayerStatSchema);

if (
  !SeasonPlayerStatModel.schema.path("legacySnapshot")
) {
  SeasonPlayerStatModel.schema.add({
    legacySnapshot: { type: Boolean, default: false },
  });
}
if (!SeasonPlayerStatModel.schema.path("displayName")) {
  SeasonPlayerStatModel.schema.add({ displayName: { type: String } });
}
if (!SeasonPlayerStatModel.schema.path("ign")) {
  SeasonPlayerStatModel.schema.add({ ign: { type: String } });
}

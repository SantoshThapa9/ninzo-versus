import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { UserRole, UserStatus } from "@/types/enums";
import { getMonthlyRankStatFields } from "@/lib/monthly-rank-stats";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    // Mirrored from PlayerProfile so the user's in-game name is available
    // directly on the user document as well.
    ign: { type: String, trim: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    availableCoins: { type: Number, default: 0, min: 0 },
    lockedCoins: { type: Number, default: 0, min: 0 },
    // Monthly rank counters are reset when the season closes.
    matchesPlayed: { type: String, default: "0", match: /^\d+$/ },
    wins: { type: String, default: "0", match: /^\d+$/ },
    lastWithdrawalAt: { type: Date },
    upiId: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    paymentDetailUpdateAt: { type: Date },
    age: { type: Number, min: 1, max: 120 },
  },
  { timestamps: true },
);

UserSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };

const cachedUserModel = models.User;
if (cachedUserModel) {
  if (!cachedUserModel.schema.path("matchesPlayed")) {
    cachedUserModel.schema.add({
      matchesPlayed: { type: String, default: "0", match: /^\d+$/ },
    });
  }
  if (!cachedUserModel.schema.path("wins")) {
    cachedUserModel.schema.add({
      wins: { type: String, default: "0", match: /^\d+$/ },
    });
  }
  cachedUserModel.schema.remove("lastMatchPlayed");
  cachedUserModel.schema.remove("dailyMatchesPlayedIncrementDay");
  if (!cachedUserModel.schema.path("age")) {
    cachedUserModel.schema.add({ age: { type: Number, min: 1, max: 120 } });
  }
  if (!cachedUserModel.schema.path("phoneNumber")) {
    cachedUserModel.schema.add({ phoneNumber: { type: String, trim: true } });
  }
  if (!cachedUserModel.schema.path("paymentDetailUpdateAt")) {
    cachedUserModel.schema.add({ paymentDetailUpdateAt: { type: Date } });
  }
  cachedUserModel.schema.remove([
    "adultConfirmationAt",
    "isAdultConfirmed",
    "payoutDetailsUpdatedAt",
    "ageUpdatedAt",
    "displayNameUpdatedAt",
    "ageChangedAt",
    "paymentDetailsChangedAt",
    "profileUpdateAt",
  ]);
}

export const UserModel = cachedUserModel || model("User", UserSchema);

export function ensureMonthlyRankStatFields(date: Date) {
  const fields = getMonthlyRankStatFields(date);
  for (const field of [fields.matchesPlayed, fields.wins]) {
    if (!UserModel.schema.path(field)) {
      UserModel.schema.add({
        [field]: { type: String, default: "0", match: /^\d+$/ },
      });
    }
  }
  return fields;
}

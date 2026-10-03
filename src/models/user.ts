import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { UserRole, UserStatus } from "@/types/enums";
import { normalizeLastMatchPlayed } from "@/lib/last-match-played";

function normalizeLastMatchPlayedForStorage(value: unknown) {
  if (typeof value !== "string") return value;
  return normalizeLastMatchPlayed(value) ?? value;
}

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    displayNameUpdatedAt: { type: Date },
    // Mirrored from PlayerProfile so the user's in-game identity is available
    // directly on the user document as well.
    ign: { type: String, trim: true },
    uid: { type: String, trim: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    availableCoins: { type: Number, default: 0, min: 0 },
    lockedCoins: { type: Number, default: 0, min: 0 },
    // Rank counters are updated on settlement; draws count as matches but do
    // not increment wins. Inactivity decay also increments matchesPlayed.
    matchesPlayed: { type: String, default: "0", match: /^\d+$/ },
    wins: { type: String, default: "0", match: /^\d+$/ },
    lastMatchPlayed: { type: Date, set: normalizeLastMatchPlayedForStorage },
    // UTC day on which the daily stats job last applied its synthetic
    // matches-played increment. This is the per-user idempotency guard.
    dailyMatchesPlayedIncrementDay: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    lastWithdrawalAt: { type: Date },
    upiId: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    payoutDetailsUpdatedAt: { type: Date },
    age: { type: Number, min: 1, max: 120 },
    ageUpdatedAt: { type: Date },
    isAdultConfirmed: { type: Boolean },
    adultConfirmationAt: { type: Date },
  },
  { timestamps: true },
);

UserSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };

const cachedUserModel = models.User;
if (cachedUserModel) {
  if (!cachedUserModel.schema.path("displayNameUpdatedAt")) {
    cachedUserModel.schema.add({ displayNameUpdatedAt: { type: Date } });
  }
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
  if (!cachedUserModel.schema.path("lastMatchPlayed")) {
    cachedUserModel.schema.add({
      lastMatchPlayed: { type: Date, set: normalizeLastMatchPlayedForStorage },
    });
  } else {
    cachedUserModel.schema
      .path<Schema.Types.Date>("lastMatchPlayed")
      .set(normalizeLastMatchPlayedForStorage);
  }
  if (!cachedUserModel.schema.path("dailyMatchesPlayedIncrementDay")) {
    cachedUserModel.schema.add({
      dailyMatchesPlayedIncrementDay: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    });
  }
  if (!cachedUserModel.schema.path("isAdultConfirmed")) {
    cachedUserModel.schema.add({ isAdultConfirmed: { type: Boolean } });
  }
  if (!cachedUserModel.schema.path("age")) {
    cachedUserModel.schema.add({ age: { type: Number, min: 1, max: 120 } });
  }
  if (!cachedUserModel.schema.path("ageUpdatedAt")) {
    cachedUserModel.schema.add({ ageUpdatedAt: { type: Date } });
  }
  if (!cachedUserModel.schema.path("phoneNumber")) {
    cachedUserModel.schema.add({ phoneNumber: { type: String, trim: true } });
  }
  if (!cachedUserModel.schema.path("payoutDetailsUpdatedAt")) {
    cachedUserModel.schema.add({ payoutDetailsUpdatedAt: { type: Date } });
  }
  if (!cachedUserModel.schema.path("adultConfirmationAt")) {
    cachedUserModel.schema.add({ adultConfirmationAt: { type: Date } });
  }
}

export const UserModel = cachedUserModel || model("User", UserSchema);

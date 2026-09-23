import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { UserRole, UserStatus } from "@/types/enums";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    // Mirrored from PlayerProfile so the user's in-game identity is available
    // directly on the user document as well.
    ign: { type: String, trim: true },
    uid: { type: String, trim: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    availableCoins: { type: Number, default: 0, min: 0 },
    lockedCoins: { type: Number, default: 0, min: 0 },
    lastWithdrawalAt: { type: Date },
    upiId: { type: String, trim: true },
  },
  { timestamps: true },
);

UserSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };

export const UserModel = models.User || model("User", UserSchema);

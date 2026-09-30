import mongoose from "mongoose";
import { UserModel, type UserDoc } from "@/models/user";
import { UserRole } from "@/types/enums";

type Session = mongoose.ClientSession;

export const userRepository = {
  findById(id: string, session?: Session) {
    return UserModel.findById(id).session(session ?? null);
  },
  findByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() });
  },
  findPlatform(session?: Session) {
    return UserModel.findOne({ role: UserRole.PLATFORM }).session(session ?? null);
  },
  create(
    data: {
      email: string;
      passwordHash: string;
      displayName: string;
      role?: UserDoc["role"];
      status?: UserDoc["status"];
      availableCoins?: number;
      lockedCoins?: number;
    },
    session?: Session,
  ) {
    return UserModel.create([data], { session }).then((docs) => docs[0]);
  },
  updateById(id: string, update: Record<string, unknown>, session?: Session) {
    return UserModel.findByIdAndUpdate(id, update, { returnDocument: "after", session });
  },
  updateGameIdentity(id: string, ign: string, uid: string, session?: Session) {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { ign, uid } },
      { returnDocument: "after", session },
    );
  },
  updateDisplayNameIfAllowed(
    id: string,
    displayName: string,
    cutoff: Date,
    session?: Session,
  ) {
    return UserModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { displayNameUpdatedAt: { $exists: false } },
          { displayNameUpdatedAt: null },
          { displayNameUpdatedAt: { $lte: cutoff } },
        ],
      },
      { $set: { displayName, displayNameUpdatedAt: new Date() } },
      { returnDocument: "after", session },
    );
  },
  list(filter: Record<string, unknown> = {}, limit = 50) {
    return UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  },
};

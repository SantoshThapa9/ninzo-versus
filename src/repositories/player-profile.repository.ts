import mongoose from "mongoose";
import { PlayerProfileModel } from "@/models/player-profile";

type Session = mongoose.ClientSession;

export const playerProfileRepository = {
  findByUserId(userId: string, session?: Session) {
    return PlayerProfileModel.findOne({ userId }).session(session ?? null);
  },
  upsert(userId: string, ign: string, uid?: string, session?: Session) {
    return PlayerProfileModel.findOneAndUpdate(
      { userId },
      { $set: { ign, uid } },
      { new: true, upsert: true, session },
    );
  },
};

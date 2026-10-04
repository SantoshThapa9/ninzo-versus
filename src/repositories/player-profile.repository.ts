import mongoose from "mongoose";
import { HostedEventModel } from "@/models/hosted-event";
import { HostedTeamModel } from "@/models/hosted-team";
import { MatchModel } from "@/models/match";
import { MatchParticipantModel } from "@/models/match-participant";
import { PlayerProfileModel } from "@/models/player-profile";
import { EventStatus, MatchStatus } from "@/types/enums";

type Session = mongoose.ClientSession;

export const playerProfileRepository = {
  findByUserId(userId: string, session?: Session) {
    return PlayerProfileModel.findOne({ userId }).session(session ?? null);
  },
  findIdentitiesByUserIds(userIds: string[]) {
    return PlayerProfileModel.find({ userId: { $in: userIds } })
      .select("userId ign")
      .maxTimeMS(5_000)
      .lean();
  },
  upsert(userId: string, ign: string, session?: Session) {
    return PlayerProfileModel.findOneAndUpdate(
      { userId },
      { $set: { ign } },
      { new: true, upsert: true, session },
    );
  },
  create(userId: string, ign: string, session?: Session) {
    return PlayerProfileModel.create([{ userId, ign, identityUpdatedAt: new Date() }], { session })
      .then((docs) => docs[0]);
  },
  updateIdentityIfAllowed(userId: string, ign: string, cutoff: Date, session?: Session) {
    return PlayerProfileModel.findOneAndUpdate(
      {
        userId,
        $or: [
          { identityUpdatedAt: { $exists: false } },
          { identityUpdatedAt: null },
          { identityUpdatedAt: { $lte: cutoff } },
        ],
      },
      { $set: { ign, identityUpdatedAt: new Date() } },
      { new: true, session },
    );
  },
  async syncActiveIdentity(userId: string, previousIgn: string, ign: string, session?: Session) {
    if (previousIgn === ign) return;
    const activeMatches = await MatchModel.find({
      status: { $nin: [MatchStatus.SETTLED, MatchStatus.CANCELLED] },
      $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
    }).select("_id").session(session ?? null);
    const matchIds = activeMatches.map((match) => match._id);
    if (matchIds.length) {
      await Promise.all([
        MatchModel.updateMany({ _id: { $in: matchIds }, creatorId: userId }, { $set: { creatorIgn: ign } }, { session }),
        MatchParticipantModel.updateMany({ matchId: { $in: matchIds }, userId }, { $set: { ign } }, { session }),
      ]);
    }

    const activeEvents = await HostedEventModel.find({ status: { $nin: [EventStatus.COMPLETED, EventStatus.CANCELLED] } })
      .select("_id")
      .session(session ?? null);
    const eventIds = activeEvents.map((event) => event._id);
    if (eventIds.length) {
      await HostedTeamModel.updateMany(
        { eventId: { $in: eventIds }, captainId: userId, igns: previousIgn },
        { $set: { "igns.$[name]": ign } },
        { arrayFilters: [{ name: previousIgn }], session },
      );
    }
  },
};

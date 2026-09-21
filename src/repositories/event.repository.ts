import mongoose from "mongoose";
import { HostedEventModel } from "@/models/hosted-event";
import { HostedTeamModel } from "@/models/hosted-team";
import { EventStatus } from "@/types/enums";

type Session = mongoose.ClientSession;

export const eventRepository = {
  create(data: Record<string, unknown>, session?: Session) {
    return HostedEventModel.create([data], { session }).then((docs) => docs[0]);
  },
  findById(id: string, session?: Session) {
    return HostedEventModel.findById(id).session(session ?? null);
  },
  findByIdWithRoom(id: string) {
    return HostedEventModel.findById(id).select("+roomId +roomPassword");
  },
  listPublic() {
    return HostedEventModel.find({
      status: { $in: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_OPEN, EventStatus.LIVE] },
    })
      .sort({ eventDate: 1 })
      .lean();
  },
  listAll(filter: Record<string, unknown> = {}) {
    return HostedEventModel.find(filter).sort({ createdAt: -1 }).lean();
  },
  addTeam(
    data: {
      eventId: string;
      captainId: string;
      igns: string[];
      slotNumber: number;
      paidCoins: number;
    },
    session?: Session,
  ) {
    return HostedTeamModel.create([data], { session }).then((docs) => docs[0]);
  },
  findTeam(eventId: string, captainId: string, session?: Session) {
    return HostedTeamModel.findOne({ eventId, captainId }).session(session ?? null);
  },
  listTeams(eventId: string) {
    return HostedTeamModel.find({ eventId }).sort({ slotNumber: 1 }).lean();
  },
};

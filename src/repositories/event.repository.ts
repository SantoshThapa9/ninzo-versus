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
  listExpiredRollable(now: Date, limit = 500) {
    return HostedEventModel.find({
      status: { $in: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_OPEN] },
      registrationClosesAt: { $lte: now },
    })
      .sort({ registrationClosesAt: 1 })
      .limit(limit)
      .lean();
  },
  advanceExpiredOccurrence(
    id: string,
    expectedRegistrationClosesAt: Date,
    eventDate: Date,
    registrationClosesAt: Date,
    seasonId: mongoose.Types.ObjectId,
  ) {
    // The old close time is an optimistic-concurrency token. If another
    // request already rolled this event, this becomes a harmless no-op.
    return HostedEventModel.updateOne(
      {
        _id: id,
        status: { $in: [EventStatus.PUBLISHED, EventStatus.REGISTRATION_OPEN] },
        registrationClosesAt: expectedRegistrationClosesAt,
      },
      { $set: { eventDate, registrationClosesAt, seasonId } },
    );
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
  listCompleted(season: {
    _id: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
  }) {
    return HostedEventModel.find({
      status: EventStatus.COMPLETED,
      $or: [
        { seasonId: season._id },
        {
          seasonId: { $exists: false },
          eventDate: { $gte: season.startDate, $lte: season.endDate },
        },
      ],
    })
      .sort({ eventDate: -1, createdAt: -1 })
      .lean();
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
  listPlacedTeams(eventIds: string[]) {
    return HostedTeamModel.find({ eventId: { $in: eventIds }, placement: { $in: [1, 2, 3] } })
      .sort({ placement: 1 })
      .lean();
  },
  setTeamPlacement(teamId: string, placement: 1 | 2 | 3, session?: Session) {
    return HostedTeamModel.updateOne({ _id: teamId }, { $set: { placement } }).session(session ?? null);
  },
};

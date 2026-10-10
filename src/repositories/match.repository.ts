import mongoose from "mongoose";
import { MatchModel } from "@/models/match";
import { MatchParticipantModel } from "@/models/match-participant";

type Session = mongoose.ClientSession;

export const matchRepository = {
  create(data: Record<string, unknown>, session?: Session) {
    return MatchModel.create([data], { session }).then((docs) => docs[0]);
  },
  findById(id: string, session?: Session) {
    return MatchModel.findById(id).session(session ?? null);
  },
  hasOpenForUser(userId: string, session?: Session) {
    return MatchModel.exists({
      $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
      status: "open",
    }).session(session ?? null);
  },
  findByIdWithRoom(id: string) {
    return MatchModel.findById(id).select("+roomId +roomPassword");
  },
  updateById(id: string, update: Record<string, unknown>) {
    return MatchModel.updateOne({ _id: id }, update).exec();
  },
  addEvidenceSubmission(
    matchId: string,
    deadlineAt: Date,
    now: Date,
    session: Session,
  ) {
    return MatchModel.updateOne(
      {
        _id: matchId,
        status: "awaiting_evidence",
        $or: [
          { evidenceDeadlineAt: { $exists: false } },
          { evidenceDeadlineAt: { $gt: now } },
        ],
      },
      {
        $min: { evidenceDeadlineAt: deadlineAt },
        $inc: { evidenceSubmissionVersion: 1 },
      },
      { session },
    ).exec();
  },
  listOpen() {
    return MatchModel.find({ status: "open" })
      .select("_id creatorId creatorIgn format rounds stakeMin stakeMax rules")
      .sort({ createdAt: -1 })
      .maxTimeMS(8_000)
      .lean();
  },
  listActiveForUser(userId: string) {
    return MatchModel.find({
      $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
      status: { $in: ["accepted", "live", "awaiting_evidence", "analyzing", "result_review", "disputed"] },
    })
      .sort({ updatedAt: -1 })
      .maxTimeMS(8_000)
      .lean();
  },
  listActiveForNotifications(userId: string) {
    return MatchModel.find({
      $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
      status: {
        $in: [
          "accepted",
          "live",
          "awaiting_evidence",
          "analyzing",
          "result_review",
          "disputed",
        ],
      },
    })
      .select("_id chatNotificationMutedBy")
      .sort({ updatedAt: -1 })
      .limit(30)
      .maxTimeMS(8_000)
      .lean();
  },
  listPreviousForUser(userId: string) {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return MatchModel.find({
      $or: [{ creatorId: userId }, { opponentCaptainId: userId }],
      status: { $in: ["settled", "disputed"] },
      completedAt: { $gte: cutoff },
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();
  },
  listExpiredEvidenceDeadlines(now: Date, limit = 100) {
    return MatchModel.find({
      $or: [
        {
          status: { $in: ["awaiting_evidence", "analyzing"] },
          evidenceDeadlineAt: { $lte: now },
        },
        {
          status: "disputed",
          aiWinnerRecommendation: {
            $regex: "^Deadline expired: lone VICTORY",
          },
        },
      ],
    })
      .select("_id")
      .sort({ evidenceDeadlineAt: 1 })
      .limit(limit)
      .lean();
  },
  list(filter: Record<string, unknown>, limit = 80) {
    return MatchModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  },
  addParticipant(
    data: {
      matchId: string;
      userId: string;
      team: "A" | "B";
      ign: string;
      isCaptain: boolean;
      lockAmount?: number;
    },
    session?: Session,
  ) {
    return MatchParticipantModel.create([data], { session }).then((docs) => docs[0]);
  },
  listParticipants(matchId: string) {
    return MatchParticipantModel.find({ matchId }).lean();
  },
  listParticipantsForMatches(matchIds: string[]) {
    return MatchParticipantModel.find({ matchId: { $in: matchIds } })
      .maxTimeMS(8_000)
      .lean();
  },
};

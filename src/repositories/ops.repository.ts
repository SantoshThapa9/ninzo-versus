import { SupportTicketModel } from "@/models/support-ticket";
import { SupportMessageModel } from "@/models/support-message";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { DisputeModel } from "@/models/dispute";
import { ResultSubmissionModel } from "@/models/result-submission";
import { AuditLogModel } from "@/models/audit-log";
import { VerifiedRoomIdModel } from "@/models/verified-room-id";
import type { ClientSession } from "mongoose";
import type {
  ReportType,
  TicketSender,
  EvidenceKind,
} from "@/types/enums";
import { SupportStatus } from "@/types/enums";

export const supportRepository = {
  createTicket(data: {
    userId: string;
    source: "manual";
    category: ReportType;
    summary: string;
    matchId?: string;
    ign?: string;
    whatsappNumber?: string;
  }) {
    return SupportTicketModel.create(data);
  },
  findTicket(id: string) {
    return SupportTicketModel.findById(id);
  },
  listForUser(userId: string) {
    return SupportTicketModel.find({ userId, source: "manual" })
      .sort({ updatedAt: -1 })
      .lean();
  },
  listAdmin(status?: SupportStatus) {
    return SupportTicketModel.find({
      source: "manual",
      status: status ?? {
        $in: [
          SupportStatus.AI_ACTIVE,
          SupportStatus.PENDING_ADMIN,
          SupportStatus.ADMIN_ACTIVE,
        ],
      },
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .maxTimeMS(8_000)
      .lean();
  },
  addMessage(data: {
    ticketId: string;
    sender: TicketSender;
    body: string;
    senderId?: string;
  }) {
    return SupportMessageModel.create(data);
  },
  listMessages(ticketId: string) {
    return SupportMessageModel.find({ ticketId }).sort({ createdAt: 1 }).lean();
  },
  listEvidence(ticketId: string) {
    return SupportEvidenceModel.find({ ticketId })
      .sort({ createdAt: 1 })
      .lean();
  },
  addEvidence(data: {
    ticketId: string;
    userId: string;
    mediaUrl: string;
    blobPathname: string;
    mimeType: string;
    kind: "image";
    expiresAt?: Date;
  }) {
    return SupportEvidenceModel.create(data);
  },
};

export const resultRepository = {
  create(data: {
    matchId: string;
    userId: string;
    kind: EvidenceKind;
    mediaUrl: string;
    blobPathname: string;
    expiresAt?: Date;
    aiAnalysis?: unknown;
  }, session?: ClientSession) {
    return ResultSubmissionModel.create([data], { session }).then(
      ([submission]) => submission,
    );
  },
  listForMatch(matchId: string, session?: ClientSession) {
    return ResultSubmissionModel.find({ matchId }).session(session ?? null)
      .sort({ createdAt: -1 })
      .lean();
  },
  listForMatches(matchIds: string[]) {
    if (matchIds.length === 0) return Promise.resolve([]);
    return ResultSubmissionModel.find({ matchId: { $in: matchIds } })
      .sort({ createdAt: -1 })
      .maxTimeMS(8_000)
      .lean();
  },
  countForMatchUserKind(
    matchId: string,
    userId: string,
    kind: EvidenceKind,
    session?: ClientSession,
  ) {
    return ResultSubmissionModel.countDocuments({ matchId, userId, kind }).session(
      session ?? null,
    );
  },
  setAiAnalysis(id: string, aiAnalysis: unknown) {
    return ResultSubmissionModel.findByIdAndUpdate(
      id,
      { $set: { aiAnalysis } },
      // The result-only analysis schema replaced the former room/IGN schema.
      // In Next dev, Mongoose may retain the former compiled model during a
      // hot reload; strict mode would then silently discard `aiAnalysis.result`.
      // Keep this transition write schema-agnostic, while consumers still
      // validate the only accepted result values in parseScreenshotResult.
      { returnDocument: "after", strict: false },
    );
  },
  markUnanalyzedAsUnavailable(matchId: string, session?: ClientSession) {
    return ResultSubmissionModel.updateMany(
      {
        matchId,
        kind: "post_match_result",
        aiAnalysis: { $exists: false },
      },
      { $set: { aiAnalysis: { result: "UNREADABLE", extractionFailed: true } } },
    ).session(session ?? null);
  },
  retainForAdminReview(matchId: string, session?: ClientSession) {
    return ResultSubmissionModel.updateMany(
      { matchId },
      { $set: { retainForDispute: true }, $unset: { expiresAt: 1 } },
    ).session(session ?? null);
  },
  releaseAdminReviewRetention(
    matchId: string,
    expiresAt: Date,
    session?: ClientSession,
  ) {
    return ResultSubmissionModel.updateMany(
      { matchId },
      { $set: { retainForDispute: false, expiresAt } },
    ).session(session ?? null);
  },
  deleteManyForMatch(matchId: string) {
    return ResultSubmissionModel.deleteMany({ matchId });
  },
  deleteManyForMatches(matchIds: string[]) {
    return ResultSubmissionModel.deleteMany({ matchId: { $in: matchIds } });
  },
  deleteManyByIds(ids: string[]) {
    return ResultSubmissionModel.deleteMany({ _id: { $in: ids } });
  },
};

export const verifiedRoomIdRepository = {
  find(roomId: string) {
    return VerifiedRoomIdModel.findOne({ roomId }).lean();
  },
  create(data: { roomId: string; matchId: string }, session?: ClientSession) {
    return VerifiedRoomIdModel.create([data], { session }).then(
      ([record]) => record,
    );
  },
};

export const disputeRepository = {
  create(data: Record<string, unknown>) {
    return DisputeModel.create(data);
  },
  deleteForTicket(ticketId: string, session?: ClientSession) {
    return DisputeModel.deleteMany({ ticketId }).session(session ?? null);
  },
  listOpen() {
    return DisputeModel.find({ status: "open" }).sort({ createdAt: -1 }).lean();
  },
};

export const auditRepository = {
  write(data: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: unknown;
  }, session?: ClientSession) {
    return AuditLogModel.create([data], { session }).then(
      ([record]) => record,
    );
  },
  list(limit = 100) {
    return AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  },
};

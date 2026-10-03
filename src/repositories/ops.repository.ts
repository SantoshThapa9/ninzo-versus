import { SupportTicketModel } from "@/models/support-ticket";
import { SupportMessageModel } from "@/models/support-message";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { DisputeModel } from "@/models/dispute";
import { ResultSubmissionModel } from "@/models/result-submission";
import { MatchEvidenceAttemptModel } from "@/models/match-evidence-attempt";
import { AuditLogModel } from "@/models/audit-log";
import { AIConfigurationModel } from "@/models/ai-configuration";
import { VerifiedRoomIdModel } from "@/models/verified-room-id";
import type { ClientSession } from "mongoose";
import type { ReportType, SupportStatus, TicketSender, EvidenceKind } from "@/types/enums";

export const supportRepository = {
  createTicket(data: {
    userId: string;
    source: "manual";
    category: ReportType;
    summary: string;
    matchId?: string;
    freeFireUid?: string;
    ign?: string;
    whatsappNumber?: string;
  }) {
    return SupportTicketModel.create(data);
  },
  findTicket(id: string) {
    return SupportTicketModel.findById(id);
  },
  listForUser(userId: string) {
    return SupportTicketModel.find({ userId, source: "manual" }).sort({ updatedAt: -1 }).lean();
  },
  listAdmin(status?: SupportStatus) {
    return SupportTicketModel.find({ source: "manual", ...(status ? { status } : {}) })
      .sort({ updatedAt: -1 })
      .lean();
  },
  addMessage(data: { ticketId: string; sender: TicketSender; body: string; senderId?: string }) {
    return SupportMessageModel.create(data);
  },
  listMessages(ticketId: string) {
    return SupportMessageModel.find({ ticketId }).sort({ createdAt: 1 }).lean();
  },
  listEvidence(ticketId: string) {
    return SupportEvidenceModel.find({ ticketId }).sort({ createdAt: 1 }).lean();
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
  }) {
    return ResultSubmissionModel.create(data);
  },
  listForMatch(matchId: string) {
    return ResultSubmissionModel.find({ matchId }).sort({ createdAt: -1 }).lean();
  },
  countForMatchUserKind(matchId: string, userId: string, kind: EvidenceKind) {
    return ResultSubmissionModel.countDocuments({ matchId, userId, kind });
  },
  setAiAnalysis(id: string, aiAnalysis: unknown) {
    return ResultSubmissionModel.findByIdAndUpdate(id, { $set: { aiAnalysis } }, { returnDocument: "after" });
  },
  deleteManyForMatch(matchId: string) {
    return ResultSubmissionModel.deleteMany({ matchId });
  },
  deleteManyByIds(ids: string[]) {
    return ResultSubmissionModel.deleteMany({ _id: { $in: ids } });
  },
};

export const evidenceAttemptRepository = {
  recordFailure(data: { matchId: string; userId: string; reason: string }) {
    return MatchEvidenceAttemptModel.create(data);
  },
  countFailures(matchId: string, userId: string) {
    return MatchEvidenceAttemptModel.countDocuments({ matchId, userId });
  },
};

export const verifiedRoomIdRepository = {
  find(roomId: string) {
    return VerifiedRoomIdModel.findOne({ roomId }).lean();
  },
  create(
    data: { roomId: string; matchId: string },
    session?: ClientSession,
  ) {
    return VerifiedRoomIdModel.create([data], { session }).then(
      ([record]) => record,
    );
  },
};

export const disputeRepository = {
  create(data: Record<string, unknown>) {
    return DisputeModel.create(data);
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
  }) {
    return AuditLogModel.create(data);
  },
  list(limit = 100) {
    return AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  },
};

export const settingsRepository = {
  getGlobal() {
    return AIConfigurationModel.findOne({ key: "global" });
  },
  upsertGlobal(data: Record<string, unknown>) {
    return AIConfigurationModel.findOneAndUpdate(
      { key: "global" },
      { $set: data },
      { returnDocument: "after", upsert: true },
    );
  },
};

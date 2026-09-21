export const UserRole = {
  USER: "user",
  ADMIN: "admin",
  PLATFORM: "platform",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  BANNED: "banned",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const MatchStatus = {
  OPEN: "open",
  ACCEPTED: "accepted",
  LIVE: "live",
  AWAITING_EVIDENCE: "awaiting_evidence",
  RESULT_REVIEW: "result_review",
  SETTLED: "settled",
  CANCELLED: "cancelled",
  DISPUTED: "disputed",
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const EventStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  REGISTRATION_OPEN: "registration_open",
  LIVE: "live",
  RESULT_REVIEW: "result_review",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EventFormat = {
  SOLO: "solo",
  DUO: "duo",
  SQUAD: "squad",
} as const;
export type EventFormat = (typeof EventFormat)[keyof typeof EventFormat];

export const CoinTxnType = {
  DEPOSIT: "deposit",
  STAKE_LOCK: "stake_lock",
  STAKE_REFUND: "stake_refund",
  STAKE_SETTLE: "stake_settle",
  TOURNAMENT_ENTRY: "tournament_entry",
  PRIZE_PAYOUT: "prize_payout",
  WITHDRAWAL: "withdrawal",
  WITHDRAWAL_REVERSAL: "withdrawal_reversal",
  PLATFORM_FEE: "platform_fee",
} as const;
export type CoinTxnType = (typeof CoinTxnType)[keyof typeof CoinTxnType];

export const PaymentStatus = {
  CREATED: "created",
  PAID: "paid",
  FAILED: "failed",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const WithdrawalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAID: "paid",
} as const;
export type WithdrawalStatus = (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const SupportStatus = {
  AI_ACTIVE: "ai_active",
  PENDING_ADMIN: "pending_admin",
  ADMIN_ACTIVE: "admin_active",
  RESOLVED: "resolved",
} as const;
export type SupportStatus = (typeof SupportStatus)[keyof typeof SupportStatus];

export const ReportType = {
  HACKING: "hacking",
  ROOM_SETTING_MANIPULATION: "room_setting_manipulation",
  CHEATING: "cheating",
  TEAMING: "teaming",
  PAYMENT_ISSUE: "payment_issue",
  MATCH_DISPUTE: "match_dispute",
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const EvidenceKind = {
  PRE_MATCH_START: "pre_match_start",
  POST_MATCH_RESULT: "post_match_result",
  VIDEO: "video",
  OTHER: "other",
} as const;
export type EvidenceKind = (typeof EvidenceKind)[keyof typeof EvidenceKind];

export const TicketSender = {
  USER: "user",
  AI: "ai",
  ADMIN: "admin",
} as const;
export type TicketSender = (typeof TicketSender)[keyof typeof TicketSender];

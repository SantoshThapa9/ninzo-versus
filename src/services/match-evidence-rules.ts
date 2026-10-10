import { MATCH_EVIDENCE_DEADLINE_MS } from "../config/defaults.ts";

export const SCREENSHOT_RESULTS = ["VICTORY", "DEFEAT", "UNREADABLE"] as const;
export type ScreenshotResult = (typeof SCREENSHOT_RESULTS)[number];

export function getMatchEvidenceDeadline(completedAt: Date): Date {
  return new Date(completedAt.getTime() + MATCH_EVIDENCE_DEADLINE_MS);
}

export function parseScreenshotResult(value: unknown): ScreenshotResult {
  if (typeof value !== "string") return "UNREADABLE";
  const normalized = value.trim().toLocaleUpperCase();
  if (
    normalized === "VICTORY" ||
    normalized === "DEFEAT" ||
    normalized === "UNREADABLE"
  ) {
    return normalized;
  }

  const mentionsVictory = /\bVICTORY\b/.test(normalized);
  const mentionsDefeat = /\bDEFEAT\b/.test(normalized);
  if (mentionsVictory === mentionsDefeat) return "UNREADABLE";
  return mentionsVictory ? "VICTORY" : "DEFEAT";
}

export type EvidenceDecision =
  | { kind: "winner"; team: "A" | "B" }
  | { kind: "review"; reason: string };

export function decideTwoScreenshotOutcome(
  creatorResult: unknown,
  opponentResult: unknown,
): EvidenceDecision {
  const creator = parseScreenshotResult(creatorResult);
  const opponent = parseScreenshotResult(opponentResult);
  if (creator === opponent) {
    return {
      kind: "review",
      reason: `Both screenshots show ${creator}.`,
    };
  }
  if (creator === "UNREADABLE") {
    return {
      kind: "winner",
      team: opponent === "VICTORY" ? "B" : "A",
    };
  }
  if (opponent === "UNREADABLE") {
    return {
      kind: "winner",
      team: creator === "VICTORY" ? "A" : "B",
    };
  }
  if (creator === "VICTORY" && opponent === "DEFEAT") {
    return { kind: "winner", team: "A" };
  }
  if (creator === "DEFEAT" && opponent === "VICTORY") {
    return { kind: "winner", team: "B" };
  }
  return {
    kind: "review",
    reason: `Both screenshots show ${creator}.`,
  };
}

export function decideDeadlineOutcome(result: unknown): "award" | "review" {
  return parseScreenshotResult(result) === "VICTORY" ? "award" : "review";
}

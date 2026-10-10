import assert from "node:assert/strict";
import test from "node:test";
import { MATCH_EVIDENCE_DEADLINE_MS } from "../config/defaults.ts";
import {
  decideDeadlineOutcome,
  decideTwoScreenshotOutcome,
  getMatchEvidenceDeadline,
  parseScreenshotResult,
} from "./match-evidence-rules.ts";

test("sets the upload deadline from the configured duration", () => {
  const completedAt = new Date("2026-10-09T10:00:00.000Z");
  assert.equal(
    getMatchEvidenceDeadline(completedAt).toISOString(),
    new Date(completedAt.getTime() + MATCH_EVIDENCE_DEADLINE_MS).toISOString(),
  );
});

test("recognizes readable and unreadable model results", () => {
  assert.equal(parseScreenshotResult("VICTORY"), "VICTORY");
  assert.equal(parseScreenshotResult("defeat"), "DEFEAT");
  assert.equal(parseScreenshotResult("unreadable"), "UNREADABLE");
  assert.equal(parseScreenshotResult('{"result":"VICTORY"}'), "VICTORY");
  assert.equal(parseScreenshotResult("The most likely text is DEFEAT."), "DEFEAT");
  assert.equal(parseScreenshotResult("room 1234567"), "UNREADABLE");
  assert.equal(parseScreenshotResult("VICTORY or DEFEAT"), "UNREADABLE");
  assert.equal(parseScreenshotResult(undefined), "UNREADABLE");
});

test("settles opposite results for the VICTORY uploader", () => {
  assert.deepEqual(decideTwoScreenshotOutcome("VICTORY", "DEFEAT"), {
    kind: "winner",
    team: "A",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("DEFEAT", "VICTORY"), {
    kind: "winner",
    team: "B",
  });
});

test("holds matching results or unavailable extraction for admin review", () => {
  assert.deepEqual(decideTwoScreenshotOutcome("VICTORY", "VICTORY"), {
    kind: "review",
    reason: "Both screenshots show VICTORY.",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("DEFEAT", "DEFEAT"), {
    kind: "review",
    reason: "Both screenshots show DEFEAT.",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("UNREADABLE", "UNREADABLE"), {
    kind: "review",
    reason: "Both screenshots show UNREADABLE.",
  });
});

test("uses the readable screenshot when the other result is unreadable", () => {
  assert.deepEqual(decideTwoScreenshotOutcome("VICTORY", "UNREADABLE"), {
    kind: "winner",
    team: "A",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("UNREADABLE", "VICTORY"), {
    kind: "winner",
    team: "B",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("DEFEAT", "UNREADABLE"), {
    kind: "winner",
    team: "B",
  });
  assert.deepEqual(decideTwoScreenshotOutcome("UNREADABLE", "DEFEAT"), {
    kind: "winner",
    team: "A",
  });
});

test("only awards a lone VICTORY at the deadline", () => {
  assert.equal(decideDeadlineOutcome("VICTORY"), "award");
  assert.equal(decideDeadlineOutcome("DEFEAT"), "review");
  assert.equal(decideDeadlineOutcome("UNREADABLE"), "review");
  assert.equal(decideDeadlineOutcome(null), "review");
  assert.equal(decideDeadlineOutcome("unrecognized"), "review");
});

import assert from "node:assert/strict";
import test from "node:test";
import { eventOccurrenceInIst } from "./event-time.ts";

test("converts an event's IST start time to UTC", () => {
  const occurrence = eventOccurrenceInIst("2026-10-01", "00:15");
  assert.equal(occurrence.startsAt.toISOString(), "2026-09-30T18:45:00.000Z");
});

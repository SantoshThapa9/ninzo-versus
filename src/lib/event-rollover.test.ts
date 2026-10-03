import assert from "node:assert/strict";
import test from "node:test";
import {
  eventOccurrenceInIst,
  nextFutureEventOccurrence,
} from "./event-rollover.ts";

test("does not roll before an IST start time", () => {
  const next = nextFutureEventOccurrence(
    "2026-10-01",
    "20:00",
    new Date("2026-10-01T14:29:59.999Z"),
  );
  assert.equal(next.eventDate, "2026-10-01");
  assert.equal(next.startsAt.toISOString(), "2026-10-01T14:30:00.000Z");
});

test("rolls at the exact IST start time and one minute later", () => {
  for (const now of ["2026-10-01T14:30:00.000Z", "2026-10-01T14:31:00.000Z"]) {
    const next = nextFutureEventOccurrence(
      "2026-10-01",
      "20:00",
      new Date(now),
    );
    assert.equal(next.eventDate, "2026-10-02");
    assert.equal(next.startsAt.toISOString(), "2026-10-02T14:30:00.000Z");
  }
});

test("skips every missed daily occurrence and is idempotent after advancing", () => {
  const now = new Date("2026-10-05T14:31:00.000Z");
  const advanced = nextFutureEventOccurrence("2026-10-01", "20:00", now);
  assert.equal(advanced.eventDate, "2026-10-06");
  assert.deepEqual(
    nextFutureEventOccurrence(advanced.eventDate, "20:00", now),
    advanced,
  );
});

test("uses a fixed +05:30 offset rather than the server timezone", () => {
  const occurrence = eventOccurrenceInIst("2026-10-01", "00:15");
  assert.equal(occurrence.startsAt.toISOString(), "2026-09-30T18:45:00.000Z");
});

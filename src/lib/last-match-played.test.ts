import assert from "node:assert/strict";
import test from "node:test";
import {
  lastMatchPlayedDateExpression,
  normalizeLastMatchPlayed,
} from "./last-match-played.ts";

test("preserves valid MongoDB Date values", () => {
  const date = new Date("2026-09-01T07:30:00.000Z");
  assert.equal(normalizeLastMatchPlayed(date), date);
});

test("parses ISODate-wrapped legacy strings", () => {
  assert.equal(
    normalizeLastMatchPlayed('ISODate("2026-09-01T07:30:00.000Z")')?.toISOString(),
    "2026-09-01T07:30:00.000Z",
  );
  assert.equal(
    normalizeLastMatchPlayed("ISODate('2026-09-01T07:30:00.000Z')")?.toISOString(),
    "2026-09-01T07:30:00.000Z",
  );
});

test("parses plain date strings", () => {
  assert.equal(
    normalizeLastMatchPlayed("2026-09-01T07:30:00.000Z")?.toISOString(),
    "2026-09-01T07:30:00.000Z",
  );
});

test("returns null for null and invalid values", () => {
  assert.equal(normalizeLastMatchPlayed(null), null);
  assert.equal(normalizeLastMatchPlayed(undefined), null);
  assert.equal(normalizeLastMatchPlayed("not-a-date"), null);
  assert.equal(normalizeLastMatchPlayed('ISODate("not-a-date")'), null);
  assert.equal(normalizeLastMatchPlayed(new Date("invalid")), null);
  assert.equal(normalizeLastMatchPlayed(1), null);
});

test("provides a database expression that normalizes date and string values", () => {
  const expression = lastMatchPlayedDateExpression();
  assert.equal(JSON.stringify(expression).includes('"to":"date"'), true);
  assert.equal(JSON.stringify(expression).includes("ISODate"), true);
});

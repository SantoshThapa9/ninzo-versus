import assert from "node:assert/strict";
import test from "node:test";
import { getMonthlyRankStatFields } from "./monthly-rank-stats.ts";

test("uses the season month and year in monthly rank counter names", () => {
  assert.deepEqual(
    getMonthlyRankStatFields(new Date(Date.UTC(2026, 0, 1))),
    { matchesPlayed: "matchesPlayedJan2026", wins: "winsJan2026" },
  );
  assert.deepEqual(
    getMonthlyRankStatFields(new Date(Date.UTC(2027, 0, 1))),
    { matchesPlayed: "matchesPlayedJan2027", wins: "winsJan2027" },
  );
});

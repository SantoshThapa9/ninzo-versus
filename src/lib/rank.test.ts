import assert from "node:assert/strict";
import test from "node:test";
import { getRank, getRankScore } from "./rank.ts";

test("calculates 10 points per win and subtracts 5 points per loss", () => {
  assert.equal(getRankScore(3, 5), 20);
  assert.equal(getRankScore(0, 2), 0);
  assert.equal(getRankScore(4, 4), 40);
});

test("assigns the configured monthly rank score thresholds", () => {
  assert.equal(getRank(29).name, "Rookie");
  assert.equal(getRank(30).name, "Elite");
  assert.equal(getRank(50).name, "Champion");
  assert.equal(getRank(70).name, "Mythic");
  assert.equal(getRank(90).name, "Legend");
  assert.equal(getRank(100).name, "Immortal");
});

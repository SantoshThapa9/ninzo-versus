import assert from "node:assert/strict";
import test from "node:test";
import { formatTokenActivity } from "./token-activity.ts";

test("labels token credits, fees, refunds, and withdrawals for audit review", () => {
  assert.equal(formatTokenActivity("deposit"), "Deposit - tokens added");
  assert.equal(formatTokenActivity("stake_lock"), "Match entry fee reserved");
  assert.equal(formatTokenActivity("tournament_entry"), "Tournament entry fee");
  assert.equal(formatTokenActivity("stake_refund"), "Tokens refunded");
  assert.equal(formatTokenActivity("withdrawal"), "Reward redemption");
});

test("labels match settlement outcomes explicitly", () => {
  assert.equal(formatTokenActivity("stake_settle", "win"), "Match win settlement");
  assert.equal(formatTokenActivity("stake_settle", "loss"), "Match loss settlement");
  assert.equal(formatTokenActivity("stake_settle", "draw"), "Match draw settlement");
  assert.equal(formatTokenActivity("stake_settle"), "Match settlement");
});

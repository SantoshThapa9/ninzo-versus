const activityLabels: Record<string, string> = {
  deposit: "Deposit - tokens added",
  stake_lock: "Match entry fee reserved",
  stake_refund: "Tokens refunded",
  stake_settle: "Match settlement",
  tournament_entry: "Tournament entry fee",
  prize_payout: "Prize / win payout",
  daily_free_reward: "Daily free reward",
  withdrawal: "Reward redemption",
  withdrawal_reversal: "Tokens returned",
  platform_fee: "Platform fee",
};

export function formatTokenActivity(type: string, outcome?: string) {
  if (type === "stake_settle" && outcome && ["win", "loss", "draw"].includes(outcome)) {
    return `Match ${outcome} settlement`;
  }
  return activityLabels[type] ?? "Inventory updated";
}

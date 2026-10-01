const activityLabels: Record<string, string> = {
  deposit: "Tokens added",
  stake_lock: "Tokens reserved",
  stake_refund: "Tokens refunded",
  stake_settle: "Match result",
  tournament_entry: "Tournament registration",
  prize_payout: "Esports reward",
  daily_free_reward: "Daily free reward",
  withdrawal: "Reward redemption",
  withdrawal_reversal: "Tokens returned",
};

export function formatTokenActivity(type: string) {
  return activityLabels[type] ?? "Inventory updated";
}

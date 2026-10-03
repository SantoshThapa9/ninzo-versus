export const ECONOMY_OVERRIDES = {
  nvCoinsPerRupee: 1,
  minDepositCoins: 10,
  minWithdrawalCoins: 10,
  minMatchStakeCoins: 0.01,
  depositFeePercent: 0,
  withdrawalFeePercent: 0,
  platformFeePercent: 5,
} as const;

export const ECONOMY_DEFAULTS = {
  ...ECONOMY_OVERRIDES,
  maxWithdrawalsPerDay: 1,
} as const;

export function getEconomyConfig() {
  return {
    ...ECONOMY_DEFAULTS,
    nvCoinsPerRupee: ECONOMY_OVERRIDES.nvCoinsPerRupee,
    minDepositCoins: ECONOMY_OVERRIDES.minDepositCoins,
    minWithdrawalCoins: ECONOMY_OVERRIDES.minWithdrawalCoins,
    minMatchStakeCoins: ECONOMY_OVERRIDES.minMatchStakeCoins,
    depositFeePercent: ECONOMY_OVERRIDES.depositFeePercent,
    withdrawalFeePercent: ECONOMY_OVERRIDES.withdrawalFeePercent,
    platformFeePercent: ECONOMY_OVERRIDES.platformFeePercent,
  };
}

export const MEDIA_DEFAULTS = {
  // Keep all private uploads (match and support evidence) for exactly three days.
  // This is intentionally not an admin-configurable value: the purge cron relies
  // on it to keep Blob storage bounded.
  tempRetentionDays: 3,
} as const;

export const CLASH_DEFAULTS = {
  //curently only solo focus
  teamSizes: [1] as const,
  warning:
    "Check the custom-room settings carefully. Intentionally changing room settings before the match may result in investigation and account penalties.",
};

export const EVENT_FORMATS = ["solo", "duo", "squad"] as const;

export const IGN_COUNTS: Record<(typeof EVENT_FORMATS)[number], number> = {
  solo: 1,
  duo: 2,
  squad: 4,
};

export const DEFAULT_PRIZE_SPLIT = {
  platformProfitPercent: 10,
  firstPercent: 50,
  secondPercent: 30,
  thirdPercent: 10,
} as const;

export const DAILY_FREE_REWARD_SCHEDULE = [
  0.05, 0.15, 0.3, 0.55, 0.85, 1.2, 1.9,
] as const;

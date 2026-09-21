export const ECONOMY_DEFAULTS = {
  nvCoinsPerRupee: 10,
  minDepositCoins: 200,
  minWithdrawalCoins: 200,
  depositFeePercent: 3,
  withdrawalFeePercent: 0,
  maxWithdrawalsPerDay: 1,
  platformFeePercent: 10,
} as const;

export const MEDIA_DEFAULTS = {
  tempRetentionDays: 3,
} as const;

export const CLASH_DEFAULTS = {
  teamSizes: [1, 2, 3, 4, 5, 6] as const,
  warning:
    "Check the custom-room settings carefully. Every player must type start inside the Free Fire custom room and take a screenshot. Intentionally changing room settings before the match may result in investigation and account penalties.",
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

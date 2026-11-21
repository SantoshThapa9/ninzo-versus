export const ECONOMY_OVERRIDES = {
  nvCoinsPerRupee: 1,
  minDepositCoins: 10,
  minWithdrawalCoins: 10,
  minMatchStakeCoins: 0.1,
  depositFeePercent: 0,
  withdrawalFeePercent: 0,
  platformFeePercent: 5,
} as const;

export const ECONOMY_DEFAULTS = {
  ...ECONOMY_OVERRIDES,
  maxWithdrawalsPerDay: 1,
} as const;

export const AI_DEFAULTS = {
  visionModel: "gpt-6-luna",
  chatModel: "gpt-6-luna",
} as const;

export const MEDIA_DEFAULTS = {
  tempRetentionDays: 3,
} as const; //auto delete to save storage

export const CLASH_DEFAULTS = {
  teamSizes: [1, 2, 4] as const,
  warning:
    "Check the custom-room settings carefully. Intentionally changing room settings before the match may result in account penalties.",
};

export const CLASH_CHAT_EXPIRY_MS = 12 * 60 * 60 * 1000;

export const MATCH_EVIDENCE_DEADLINE_MS = 30 * 60 * 1000;

export const MATCH_HISTORY_RETENTION_DAYS = 3;

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
} as const; //for events

export const MONTHLY_RANK_PRIZE = 10; //in NV Token

export const DAILY_FREE_REWARD_SCHEDULE = [
  0.1, 0.2, 0.35, 0.6, 0.85, 1.2, 1.7,
] as const; //for a week

export const TOTAL_WEEKLY_FREE_REWARD = DAILY_FREE_REWARD_SCHEDULE.reduce(
  (sum, reward) => sum + reward,
  0,
);

export const BLOCKED_WORDS_TEXT = `
ma, madarchod, maderchod, behen, bhen,
randi, randwa, bhosdi, bhosdike, chod,
fuck, fucker, fucking, chut, choot, chutiya, chutiye, chud, chudai, chudayi, laude, lauda, lund, land, lnd, loda, lode, vosdk, vosdike, gandu, gand, gaand, bsdk, mki, mc, bc, maa, bhosda, rand, teri, tera, gey, gay, chakka, hizra, hijda, bap, papa, baap, ass, bhosadi, maki, maka, chinar, chinal, laure, re, pussy, vagina, dick, penis
`; //for private chat

export const RANK_MINIMUM_SCORES = {
  Rookie: 0,
  Elite: 5,
  Champion: 10,
  Mythic: 15,
  Legend: 20,
  Immortal: 25,
} as const;

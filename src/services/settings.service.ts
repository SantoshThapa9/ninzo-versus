import { connectDb } from "@/lib/db/mongoose";
import { unstable_cache } from "next/cache";
import { settingsRepository } from "@/repositories/ops.repository";
import {
  CLASH_DEFAULTS,
  ECONOMY_DEFAULTS,
  MEDIA_DEFAULTS,
} from "@/config/defaults";

const getCachedPlatformSettings = unstable_cache(
  async () => {
    await connectDb();
    const doc = await settingsRepository.getGlobal().maxTimeMS(5_000);
    return {
      visionEnabled: doc?.visionEnabled ?? true,
      supportAiEnabled: doc?.supportAiEnabled ?? true,
      visionModel: doc?.visionModel ?? "gpt-5.6-luna",
      chatModel: doc?.chatModel ?? "gpt-5-nano",
      nvCoinsPerRupee:
        doc?.nvCoinsPerRupee ?? ECONOMY_DEFAULTS.nvCoinsPerRupee,
      minDepositCoins: doc?.minDepositCoins ?? ECONOMY_DEFAULTS.minDepositCoins,
      minWithdrawalCoins:
        doc?.minWithdrawalCoins ?? ECONOMY_DEFAULTS.minWithdrawalCoins,
      depositFeePercent:
        doc?.depositFeePercent ?? ECONOMY_DEFAULTS.depositFeePercent,
      withdrawalFeePercent:
        doc?.withdrawalFeePercent ?? ECONOMY_DEFAULTS.withdrawalFeePercent,
      maxWithdrawalsPerDay:
        doc?.maxWithdrawalsPerDay ?? ECONOMY_DEFAULTS.maxWithdrawalsPerDay,
      platformFeePercent:
        doc?.platformFeePercent ?? ECONOMY_DEFAULTS.platformFeePercent,
      mediaRetentionDays:
        doc?.mediaRetentionDays ?? MEDIA_DEFAULTS.tempRetentionDays,
      clashWarning: doc?.clashWarning ?? CLASH_DEFAULTS.warning,
    };
  },
  ["platform-settings"],
  { revalidate: 60, tags: ["platform-settings"] },
);

export async function getPlatformSettings() {
  return getCachedPlatformSettings();
}

export async function updatePlatformSettings(data: Record<string, unknown>) {
  await connectDb();
  return settingsRepository.upsertGlobal(data);
}

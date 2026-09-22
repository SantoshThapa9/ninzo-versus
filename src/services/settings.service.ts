import { connectDb } from "@/lib/db/mongoose";
import { settingsRepository } from "@/repositories/ops.repository";
import {
  CLASH_DEFAULTS,
  ECONOMY_DEFAULTS,
  MEDIA_DEFAULTS,
} from "@/config/defaults";

export async function getPlatformSettings() {
  await connectDb();
  const doc = await settingsRepository.getGlobal();
  return {
    visionEnabled: doc?.visionEnabled ?? true,
    supportAiEnabled: doc?.supportAiEnabled ?? true,
    visionModel: doc?.visionModel ?? "gpt-5.6-luna",
    chatModel: doc?.chatModel ?? "gpt-5-nano",
    nvCoinsPerRupee: doc?.nvCoinsPerRupee ?? ECONOMY_DEFAULTS.nvCoinsPerRupee,
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
}

export async function updatePlatformSettings(data: Record<string, unknown>) {
  await connectDb();
  return settingsRepository.upsertGlobal(data);
}

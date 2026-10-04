"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createDepositOrder } from "@/services/payment.service";
import { requestWithdrawal, reviewWithdrawal } from "@/services/withdrawal.service";
import { updatePlatformSettings } from "@/services/settings.service";
import { savePlayerIdentity } from "@/services/player-profile.service";
import { saveAge, savePayoutDetails } from "@/services/upi.service";
import { claimDailyFreeReward } from "@/services/wallet.service";

export async function createDepositAction(coins: number) {
  const session = await requireSession();
  await rateLimit(`deposit:${session.user.id}`, 8, 60);
  return createDepositOrder(session.user.id, coins);
}

export async function withdrawAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    await rateLimit(`withdraw:${session.user.id}`, 4, 60);
    await requestWithdrawal(session.user.id, {
      coins: Number(formData.get("coins")),
      upiId: String(formData.get("upiId") ?? ""),
    });
    revalidatePath("/inventory");
    return { ok: true };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function claimDailyFreeRewardAction(
  prev: { error?: string; ok?: boolean; message?: string; rewardDay?: number; amount?: number } | null,
  formData: FormData,
) {
  try {
    void prev;
    void formData;
    const session = await requireSession();
    const result = await claimDailyFreeReward(session.user.id);
    revalidatePath("/inventory");
    revalidatePath("/");
    return {
      ok: true,
      rewardDay: result.rewardDay,
      amount: result.amount,
      message: result.claimedNow
        ? `Day ${result.rewardDay} claimed: ${result.amount} NV added.`
        : "Today's reward was already claimed.",
    };
  } catch (error) {
    console.error("Daily free NV claim failed", error);
    return { error: toErrorMessage(error) };
  }
}

export async function reviewWithdrawalAction(formData: FormData) {
  const session = await requireAdmin();
  await reviewWithdrawal(
    session.user.id,
    String(formData.get("withdrawalId") ?? ""),
    String(formData.get("action") ?? "approve") as "approve" | "reject" | "paid",
    String(formData.get("note") ?? ""),
  );
  revalidatePath("/admin/withdrawals");
}

export type SaveProfileState = {
  error?: string;
  ok?: boolean;
  message?: string;
  age?: number;
} | null;

export async function saveProfileAction(
  _prev: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  try {
    const session = await requireSession();
    await savePlayerIdentity(session.user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      ign: String(formData.get("ign") ?? ""),
    });
    updateTag("public-open-matches");
    updateTag("global-rankings");
    const ageResult = await saveAge(session.user.id, formData.get("age"));
    const upiId = String(formData.get("upiId") ?? "").trim();
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
    if (upiId || phoneNumber) {
      await savePayoutDetails(session.user.id, { upiId, phoneNumber });
    }
    revalidatePath("/profile");
    revalidatePath("/");
    revalidatePath("/challenges");
    revalidatePath("/matches");
    revalidatePath("/rank");
    return {
      ok: true,
      age: ageResult.age,
      message: ageResult.isAdult
        ? "Profile saved. You can now use your UPI ID."
        : "Age saved. UPI is available only to users 18 or older.",
    };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  await updatePlatformSettings({
    platformFeePercent: Number(formData.get("platformFeePercent")),
    minDepositCoins: Number(formData.get("minDepositCoins")),
    minWithdrawalCoins: Number(formData.get("minWithdrawalCoins")),
    depositFeePercent: Number(formData.get("depositFeePercent")),
    visionEnabled: formData.get("visionEnabled") === "on",
    supportAiEnabled: formData.get("supportAiEnabled") === "on",
    visionModel: String(formData.get("visionModel") ?? ""),
    chatModel: String(formData.get("chatModel") ?? ""),
    clashWarning: String(formData.get("clashWarning") ?? ""),
  });
  updateTag("platform-settings");
  revalidatePath("/admin/ai");
}

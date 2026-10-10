"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createDepositOrder } from "@/services/payment.service";
import {
  requestWithdrawal,
  reviewWithdrawal,
} from "@/services/withdrawal.service";
import { saveProfile } from "@/services/player-profile.service";
import { claimDailyFreeReward } from "@/services/wallet.service";

export async function createDepositAction(coins: number) {
  const session = await requireSession();
  await rateLimit(`deposit:${session.user.id}`, 8, 60);
  return createDepositOrder(session.user.id, coins);
}

export async function withdrawAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
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
  prev: {
    error?: string;
    ok?: boolean;
    message?: string;
    rewardDay?: number;
    amount?: number;
  } | null,
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
    String(formData.get("action") ?? "approve") as
      | "approve"
      | "reject"
      | "paid",
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
    const result = await saveProfile(session.user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      ign: String(formData.get("ign") ?? ""),
      age: String(formData.get("age") ?? ""),
      upiId: String(formData.get("upiId") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
    });
    updateTag("public-open-matches");
    updateTag("global-rankings");
    revalidatePath("/profile");
    revalidatePath("/");
    revalidatePath("/challenges");
    revalidatePath("/matches");
    revalidatePath("/rank");
    return {
      ok: true,
      age: result.age,
      message:
        result.age >= 18
          ? "Profile saved. You can now use your UPI ID."
          : "Age saved. UPI is available only to users 18 or older.",
    };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

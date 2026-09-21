"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createDepositOrder } from "@/services/payment.service";
import { requestWithdrawal, reviewWithdrawal } from "@/services/withdrawal.service";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { connectDb } from "@/lib/db/mongoose";
import { updatePlatformSettings } from "@/services/settings.service";

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
    revalidatePath("/wallet");
    return { ok: true };
  } catch (error) {
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
    String(formData.get("utr") ?? ""),
  );
  revalidatePath("/admin/withdrawals");
}

export async function saveProfileAction(formData: FormData) {
  const session = await requireSession();
  await connectDb();
  await playerProfileRepository.upsert(
    session.user.id,
    String(formData.get("ign") ?? ""),
    String(formData.get("uid") ?? ""),
  );
  revalidatePath("/profile");
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
  revalidatePath("/admin/ai");
}

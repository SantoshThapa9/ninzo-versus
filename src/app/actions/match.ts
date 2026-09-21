"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  acceptClashMatch,
  adminSettleMatch,
  createClashMatch,
  setMatchLive,
} from "@/services/match.service";
import { EvidenceKind } from "@/types/enums";

export async function createMatchAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    await rateLimit(`match:create:${session.user.id}`, 6, 60);
    const match = await createClashMatch(session.user.id, {
      format: Number(formData.get("format")),
      stakeMin: Number(formData.get("stakeMin")),
      stakeMax: Number(formData.get("stakeMax")),
      rules: String(formData.get("rules") ?? ""),
      ign: String(formData.get("ign") ?? ""),
      warningAcknowledged: formData.get("warning") === "on",
    });
    revalidatePath("/lobby");
    redirect(`/clash/${String(match._id)}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function acceptMatchAction(_prev: { error?: string } | null, formData: FormData) {
  try {
    const session = await requireSession();
    await rateLimit(`match:accept:${session.user.id}`, 8, 60);
    await acceptClashMatch(session.user.id, {
      matchId: String(formData.get("matchId") ?? ""),
      stake: Number(formData.get("stake")),
      ign: String(formData.get("ign") ?? ""),
      warningAcknowledged: formData.get("warning") === "on",
    });
    revalidatePath("/lobby");
    redirect(`/clash/${String(formData.get("matchId") ?? "")}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function adminLiveMatchAction(formData: FormData) {
  const session = await requireAdmin();
  await setMatchLive(
    session.user.id,
    String(formData.get("matchId") ?? ""),
    String(formData.get("roomId") ?? ""),
    String(formData.get("roomPassword") ?? ""),
  );
  revalidatePath("/admin/matches");
}

export async function adminSettleAction(formData: FormData) {
  const session = await requireAdmin();
  await adminSettleMatch(
    session.user.id,
    String(formData.get("matchId") ?? ""),
    String(formData.get("winnerTeam") ?? "A") as "A" | "B",
  );
  revalidatePath("/admin/matches");
}

export async function evidenceKindFromForm(value: string): Promise<EvidenceKind> {
  if (value === EvidenceKind.PRE_MATCH_START) return EvidenceKind.PRE_MATCH_START;
  if (value === EvidenceKind.POST_MATCH_RESULT) return EvidenceKind.POST_MATCH_RESULT;
  if (value === EvidenceKind.VIDEO) return EvidenceKind.VIDEO;
  return EvidenceKind.OTHER;
}

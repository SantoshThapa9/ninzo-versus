"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { isNextRedirect, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  acceptClashMatch,
  adminSettleMatch,
  confirmMatchCompleted,
  createClashMatch,
  deleteOpenClashMatch,
  setMatchLive,
  undoMatchCompleted,
} from "@/services/match.service";
import { notifyChallengeAccepted } from "@/services/push-notification.service";
import { getCurrentUserIdentity } from "@/services/player-profile.service";
import { EvidenceKind } from "@/types/enums";

export async function createMatchAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    await rateLimit(`match:create:${session.user.id}`, 6, 60);
    const onlyHeadshots = formData.get("onlyHeadshots") === "on";
    const characterSkillAllowed =
      formData.get("characterSkillAllowed") === "on";
    const rules = `Only headshots: ${onlyHeadshots ? "Yes" : "No"}. Character skill allowed: ${characterSkillAllowed ? "Yes" : "No"}.`;

    const match = await createClashMatch(session.user.id, {
      format: Number(formData.get("format")),
      stakeMin: Number(formData.get("stakeMin")),
      stakeMax: Number(formData.get("stakeMax")),
      rules,
      warningAcknowledged: formData.get("warning") === "on",
    });
    revalidatePath("/");
    redirect(`/clash/${String(match._id)}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error("[match:create] Challenge creation failed.", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      fields:
        typeof error === "object" && error !== null && "errors" in error
          ? Object.keys((error as { errors?: Record<string, unknown> }).errors ?? {})
          : undefined,
    });
    return { error: toErrorMessage(error) };
  }
}

export async function acceptMatchAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    await rateLimit(`match:accept:${session.user.id}`, 8, 60);
    const { match, acceptedNow } = await acceptClashMatch(session.user.id, {
      matchId: String(formData.get("matchId") ?? ""),
      stake: Number(formData.get("stake")),
      warningAcknowledged: formData.get("warning") === "on",
    });
    if (acceptedNow) {
      const opponentIgn =
        (await getCurrentUserIdentity(session.user.id)).ign || "An opponent";
      // A notification failure must never reverse a successfully accepted match.
      await notifyChallengeAccepted(
        String(match.creatorId),
        opponentIgn,
        String(match._id),
      );
    }
    revalidatePath("/");
    revalidatePath("/challenges");
    revalidatePath(`/clash/${String(match._id)}`);
    redirect(`/clash/${String(formData.get("matchId") ?? "")}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function deleteMatchAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    const matchId = String(formData.get("matchId") ?? "");
    await deleteOpenClashMatch(session.user.id, matchId);
    revalidatePath("/");
    revalidatePath("/challenges");
    revalidatePath(`/clash/${matchId}`);
    redirect("/challenges");
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

export async function confirmMatchCompletedAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    const matchId = String(formData.get("matchId") ?? "");
    await confirmMatchCompleted(session.user.id, matchId);
    revalidatePath(`/clash/${matchId}`);
    revalidatePath("/challenges");
    redirect(`/clash/${matchId}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function undoMatchCompletedAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  try {
    const session = await requireSession();
    const matchId = String(formData.get("matchId") ?? "");
    await undoMatchCompleted(session.user.id, matchId);
    revalidatePath(`/clash/${matchId}`);
    revalidatePath("/challenges");
    redirect(`/clash/${matchId}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: toErrorMessage(error) };
  }
}

export async function adminSettleAction(formData: FormData) {
  const session = await requireAdmin();
  const winnerTeam = String(formData.get("winnerTeam") ?? "");
  if (winnerTeam !== "A" && winnerTeam !== "B" && winnerTeam !== "DRAW") {
    throw new Error("Invalid match settlement decision.");
  }
  await adminSettleMatch(
    session.user.id,
    String(formData.get("matchId") ?? ""),
    winnerTeam,
  );
  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidatePath("/rank");
  revalidatePath("/profile");
  revalidatePath(`/clash/${String(formData.get("matchId") ?? "")}`);
}

export async function evidenceKindFromForm(
  value: string,
): Promise<EvidenceKind> {
  if (value === EvidenceKind.POST_MATCH_RESULT)
    return EvidenceKind.POST_MATCH_RESULT;
  if (value === EvidenceKind.VIDEO) return EvidenceKind.VIDEO;
  return EvidenceKind.OTHER;
}

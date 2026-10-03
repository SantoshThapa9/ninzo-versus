"use server";

import { revalidatePath, updateTag } from "next/cache";
import { isLocalDevelopmentRequest } from "@/lib/dev-seed-access";
import { saveDevDummyUser } from "@/services/dev-seed.service";

export type DevSeedActionResult =
  | {
      ok: true;
      created: boolean;
      user: Awaited<ReturnType<typeof saveDevDummyUser>>["user"];
    }
  | { ok: false; error: string };

export async function devSeedAction(
  input: {
    displayName: string;
    ign: string;
    matchesPlayed: string;
    wins: string;
  },
  selectedUserId?: string,
): Promise<DevSeedActionResult> {
  if (!(await isLocalDevelopmentRequest())) {
    return {
      ok: false,
      error: "Seeding is available only from localhost during development.",
    };
  }

  try {
    const result = await saveDevDummyUser(input, selectedUserId);
    updateTag("global-rankings");
    revalidatePath("/rank");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    console.error("[dev-seed] Unexpected failure while seeding records.", error);
    return {
      ok: false,
      error: "An unexpected error occurred while seeding records.",
    };
  }
}

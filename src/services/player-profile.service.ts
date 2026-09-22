import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { playerProfileRepository } from "@/repositories/player-profile.repository";

const identitySchema = z.object({
  ign: z.string().trim().min(2, "In Game Name must be at least 2 characters.").max(20),
  uid: z.string().trim().max(30),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function savePlayerIdentity(userId: string, raw: unknown) {
  const input = identitySchema.parse(raw);
  await connectDb();

  return withTransaction(async (session) => {
    const existing = await playerProfileRepository.findByUserId(userId, session);
    if (!existing) return playerProfileRepository.create(userId, input.ign, input.uid, session);

    const previousIgn = existing.ign;
    const previousUid = existing.uid ?? "";
    if (previousIgn === input.ign && previousUid === input.uid) return existing;

    const updated = await playerProfileRepository.updateIdentityIfAllowed(
      userId,
      input.ign,
      input.uid,
      new Date(Date.now() - DAY_MS),
      session,
    );
    if (!updated) {
      throw new AppError("You can change your In Game Name and UID once every 24 hours.", "IDENTITY_CHANGE_LIMIT");
    }
    await playerProfileRepository.syncActiveIdentity(userId, previousIgn, input.ign, session);
    return updated;
  });
}

import { z } from "zod";
import type { ClientSession } from "mongoose";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { userRepository } from "@/repositories/user.repository";

const identitySchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(24),
  ign: z
    .string()
    .trim()
    .min(2, "In Game Name must be at least 2 characters.")
    .max(20),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getCurrentUserIdentity(userId: string) {
  const [user, profile] = await Promise.all([
    userRepository.findById(userId),
    playerProfileRepository.findByUserId(userId),
  ]);

  return {
    ign: user?.ign ?? profile?.ign ?? "",
  };
}

export async function getCurrentUserIdentities(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  await connectDb();
  const [users, profiles] = await Promise.all([
    userRepository.findIdentitiesByIds(uniqueIds),
    playerProfileRepository.findIdentitiesByUserIds(uniqueIds),
  ]);
  const profilesByUserId = new Map(
    profiles.map((profile) => [String(profile.userId), profile]),
  );
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  return new Map(
    uniqueIds.map((userId) => {
      const user = usersById.get(userId);
      const profile = profilesByUserId.get(userId);
      return [
        userId,
        {
          ign: user?.ign ?? profile?.ign ?? "",
        },
      ];
    }),
  );
}

async function applyDisplayNameIfChanged(
  userId: string,
  displayName: string,
  session: ClientSession,
) {
  const user = await userRepository.findById(userId, session);
  if (!user || user.displayName === displayName) return;
  const renamed = await userRepository.updateDisplayNameIfAllowed(
    userId,
    displayName,
    new Date(Date.now() - DAY_MS),
    session,
  );
  if (!renamed) {
    throw new AppError(
      "You can change your display name once every 24 hours.",
      "DISPLAY_NAME_CHANGE_LIMIT",
    );
  }
}

export async function savePlayerIdentity(userId: string, raw: unknown) {
  const input = identitySchema.parse(raw);
  await connectDb();

  return withTransaction(async (session) => {
    const existing = await playerProfileRepository.findByUserId(
      userId,
      session,
    );
    if (!existing) {
      const profile = await playerProfileRepository.create(
        userId,
        input.ign,
        session,
      );
      await userRepository.updateGameIdentity(
        userId,
        input.ign,
        session,
      );
      await applyDisplayNameIfChanged(userId, input.displayName, session);
      return profile;
    }

    const previousIgn = existing.ign;
    if (previousIgn === input.ign) {
      // Repair user documents created before identity mirroring was introduced.
      await userRepository.updateGameIdentity(
        userId,
        input.ign,
        session,
      );
      await applyDisplayNameIfChanged(userId, input.displayName, session);
      return existing;
    }

    const updated = await playerProfileRepository.updateIdentityIfAllowed(
      userId,
      input.ign,
      new Date(Date.now() - DAY_MS),
      session,
    );
    if (!updated) {
      throw new AppError(
        "You can change your In Game Name once every 24 hours.",
        "IDENTITY_CHANGE_LIMIT",
      );
    }
    await playerProfileRepository.syncActiveIdentity(
      userId,
      previousIgn,
      input.ign,
      session,
    );
    await userRepository.updateGameIdentity(
      userId,
      input.ign,
      session,
    );
    await applyDisplayNameIfChanged(userId, input.displayName, session);
    return updated;
  });
}

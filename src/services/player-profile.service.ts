import { z } from "zod";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { userRepository } from "@/repositories/user.repository";
import {
  ageSchema,
  phoneNumberSchema,
  upiIdSchema,
} from "@/services/upi.service";

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

const profileSaveSchema = identitySchema.extend({
  age: z.string(),
  upiId: z.string(),
  phoneNumber: z.string(),
});

const PROFILE_CHANGE_LOCK_MS = 24 * 60 * 60 * 1000;

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

export async function saveProfile(userId: string, raw: unknown) {
  const input = profileSaveSchema.parse(raw);
  const parsedAge = ageSchema.safeParse(input.age);
  if (!parsedAge.success) {
    throw new AppError("Please enter a valid age.", "INVALID_AGE");
  }
  const rawUpiId = input.upiId.trim();
  const rawPhoneNumber = input.phoneNumber.trim();
  const hasPaymentDetails = Boolean(rawUpiId || rawPhoneNumber);
  let upiId: string | undefined;
  let phoneNumber: string | undefined;
  if (hasPaymentDetails) {
    const parsedUpiId = upiIdSchema.safeParse(rawUpiId);
    const parsedPhoneNumber = phoneNumberSchema.safeParse(rawPhoneNumber);
    if (!parsedUpiId.success || !parsedPhoneNumber.success) {
      throw new AppError(
        "Enter a valid UPI ID and phone number.",
        "INVALID_PAYOUT_DETAILS",
      );
    }
    if (parsedAge.data < 18) {
      throw new AppError(
        "UPI details are available only to users 18 or older.",
        "AGE_REQUIREMENT",
      );
    }
    upiId = parsedUpiId.data;
    phoneNumber = parsedPhoneNumber.data;
  }

  await connectDb();

  return withTransaction(async (session) => {
    const user = await userRepository.findById(userId, session);
    const existingProfile = await playerProfileRepository.findByUserId(
      userId,
      session,
    );
    if (!user) throw new AppError("User not found.", "NOT_FOUND", 404);

    const profileChanges: {
      displayName?: string;
      ign?: string;
      age?: number;
      upiId?: string;
      phoneNumber?: string;
    } = {};
    if (user.displayName !== input.displayName) {
      profileChanges.displayName = input.displayName;
    }
    if (user.ign !== input.ign || existingProfile?.ign !== input.ign) {
      profileChanges.ign = input.ign;
    }
    if (user.age !== parsedAge.data) {
      profileChanges.age = parsedAge.data;
    }
    if (
      upiId !== undefined &&
      phoneNumber !== undefined &&
      (user.upiId !== upiId || user.phoneNumber !== phoneNumber)
    ) {
      profileChanges.upiId = upiId;
      profileChanges.phoneNumber = phoneNumber;
    }

    const hasChanges = Object.keys(profileChanges).length > 0;
    const hasPaymentChanges =
      profileChanges.upiId !== undefined ||
      profileChanges.phoneNumber !== undefined;
    const hasGeneralChanges =
      profileChanges.displayName !== undefined ||
      profileChanges.ign !== undefined ||
      profileChanges.age !== undefined;
    if (
      hasGeneralChanges &&
      user.updatedAt &&
      user.updatedAt.getTime() >
        Date.now() - PROFILE_CHANGE_LOCK_MS
    ) {
      throw new AppError(
        "Profile details can be changed once every 24 hours.",
        "PROFILE_CHANGE_LIMIT",
      );
    }
    if (
      hasPaymentChanges &&
      user.paymentDetailUpdateAt &&
      user.paymentDetailUpdateAt.getTime() >
        Date.now() - PROFILE_CHANGE_LOCK_MS
    ) {
      throw new AppError(
        "Payment details can be changed once every 24 hours.",
        "PAYMENT_DETAILS_CHANGE_LIMIT",
      );
    }

    if (hasChanges) {
      const updatedUser = await userRepository.updateProfileIfAllowed(
        userId,
        profileChanges,
        new Date(Date.now() - PROFILE_CHANGE_LOCK_MS),
        session,
      );
      if (!updatedUser) {
        throw new AppError(
          hasPaymentChanges && !hasGeneralChanges
            ? "Payment details can be changed once every 24 hours."
            : "Profile details can be changed once every 24 hours.",
          hasPaymentChanges && !hasGeneralChanges
            ? "PAYMENT_DETAILS_CHANGE_LIMIT"
            : "PROFILE_CHANGE_LIMIT",
        );
      }
    }

    if (!existingProfile) {
      await playerProfileRepository.create(userId, input.ign, session);
    } else if (existingProfile.ign !== input.ign) {
      const updatedProfile = await playerProfileRepository.updateIdentity(
        userId,
        input.ign,
        session,
      );
      if (!updatedProfile) {
        throw new AppError(
          "Profile changed while saving. Please try again.",
          "PROFILE_SAVE_CONFLICT",
        );
      }
      await playerProfileRepository.syncActiveIdentity(
        userId,
        existingProfile.ign,
        input.ign,
        session,
      );
    }
    return { age: parsedAge.data };
  });
}

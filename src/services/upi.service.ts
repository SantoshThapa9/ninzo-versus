import { z } from "zod";
import type { ClientSession } from "mongoose";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { userRepository } from "@/repositories/user.repository";

const PAYOUT_DETAILS_LOCK_MS = 24 * 60 * 60 * 1000;
const AGE_CHANGE_LOCK_MS = 24 * 60 * 60 * 1000;

const ageSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(120));

export const upiIdSchema = z
  .string()
  .trim()
  .min(5)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/);

export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, "Please enter a valid phone number.");

export async function saveAge(userId: string, rawAge: unknown) {
  const parsedAge = ageSchema.safeParse(rawAge);
  if (!parsedAge.success) {
    throw new AppError("Please enter a valid age.", "INVALID_AGE");
  }

  await connectDb();
  const existing = await userRepository.findById(userId);
  if (!existing) throw new AppError("User not found.", "NOT_FOUND", 404);
  const unchanged = existing.age === parsedAge.data;
  const updated = unchanged
    ? await userRepository.updateAgeWithoutChange(userId, parsedAge.data)
    : await userRepository.updateAgeIfAllowed(
        userId,
        parsedAge.data,
        new Date(Date.now() - AGE_CHANGE_LOCK_MS),
      );
  if (!updated) {
    if (!unchanged) {
      throw new AppError(
        "Age can be changed once every 24 hours.",
        "AGE_CHANGE_LIMIT",
      );
    }
    throw new AppError(
      "Profile changed while saving. Please try again.",
      "PROFILE_SAVE_CONFLICT",
    );
  }

  return { age: parsedAge.data, isAdult: parsedAge.data >= 18 };
}

export async function savePayoutDetails(
  userId: string,
  raw: { upiId: unknown; phoneNumber: unknown },
  session?: ClientSession,
) {
  const parsedUpiId = upiIdSchema.safeParse(raw.upiId);
  const parsedPhoneNumber = phoneNumberSchema.safeParse(raw.phoneNumber);
  if (!parsedUpiId.success || !parsedPhoneNumber.success) {
    throw new AppError(
      "Enter a valid UPI ID and phone number.",
      "INVALID_PAYOUT_DETAILS",
    );
  }

  await connectDb();
  const existing = await userRepository.findById(userId, session);
  if (!existing) throw new AppError("User not found.", "NOT_FOUND", 404);
  if (
    existing.upiId === parsedUpiId.data &&
    existing.phoneNumber === parsedPhoneNumber.data
  ) {
    return existing;
  }
  if (existing.isAdultConfirmed !== true) {
    throw new AppError(
      "Confirm that you are 18 or older before saving a UPI ID.",
      "AGE_CONFIRMATION_REQUIRED",
    );
  }

  const updated = await userRepository.updatePayoutDetailsIfAllowed(
    userId,
    parsedUpiId.data,
    parsedPhoneNumber.data,
    new Date(Date.now() - PAYOUT_DETAILS_LOCK_MS),
    session,
  );
  if (!updated) {
    throw new AppError(
      "Your UPI ID and phone number can be changed once every 24 hours.",
      "PAYOUT_DETAILS_CHANGE_LIMIT",
    );
  }
  return updated;
}

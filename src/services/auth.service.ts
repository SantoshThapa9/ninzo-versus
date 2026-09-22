import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { userRepository } from "@/repositories/user.repository";
import { UserRole, UserStatus } from "@/types/enums";
import { getEnv } from "@/config/env";

export function isBootstrapAdminEmail(email?: string | null) {
  if (!email) return false;
  return (getEnv().ADMIN_BOOTSTRAP_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(email.trim().toLowerCase());
}

export async function registerUser(email: string, password: string, displayName: string) {
  await connectDb();
  const existing = await userRepository.findByEmail(email);
  if (existing) throw new AppError("Email already registered.", "EMAIL_TAKEN");
  const passwordHash = await bcrypt.hash(password, 12);
  const role = isBootstrapAdminEmail(email) ? UserRole.ADMIN : UserRole.USER;
  return userRepository.create({
    email: email.toLowerCase(),
    passwordHash,
    displayName,
    role,
    status: UserStatus.ACTIVE,
    availableCoins: 0,
    lockedCoins: 0,
  });
}

export async function verifyUser(email: string, password: string) {
  await connectDb();
  const user = await userRepository.findByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError("This account is not active.", "ACCOUNT_BLOCKED", 403);
  }
  return user;
}

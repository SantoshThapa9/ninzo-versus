import mongoose from "mongoose";
import { AppError } from "@/lib/errors";
import { roundTokens } from "@/lib/utils";
import { userRepository } from "@/repositories/user.repository";
import { ledgerRepository } from "@/repositories/finance.repository";
import { CoinTxnType, UserRole } from "@/types/enums";
import bcrypt from "bcryptjs";

type LedgerInput = {
  userId: string;
  type: CoinTxnType;
  amount: number;
  availableDelta: number;
  lockedDelta: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadata?: unknown;
  session: mongoose.ClientSession;
};

export async function applyLedger(input: LedgerInput) {
  const existing = await ledgerRepository.findByIdempotency(input.idempotencyKey, input.session);
  if (existing) return existing;

  const user = await userRepository.findById(input.userId, input.session);
  if (!user) throw new AppError("User not found.", "USER_NOT_FOUND", 404);

  // Persist normalized values so repeated fractional credits/debits never
  // accumulate JavaScript floating-point artifacts (for example 0.1 + 0.2).
  const available = roundTokens(user.availableCoins + input.availableDelta);
  const locked = roundTokens(user.lockedCoins + input.lockedDelta);
  if (available < 0 || locked < 0) {
    throw new AppError("Insufficient NV Tokens for match registration.", "INSUFFICIENT_FUNDS");
  }

  user.availableCoins = available;
  user.lockedCoins = locked;
  await user.save({ session: input.session });

  return ledgerRepository.create(
    {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      availableAfter: available,
      lockedAfter: locked,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    input.session,
  );
}

export async function getOrCreatePlatformUser(session?: mongoose.ClientSession) {
  const existing = await userRepository.findPlatform(session);
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  return userRepository.create(
    {
      email: "platform@ninzoversus.internal",
      passwordHash,
      displayName: "Ninzo Versus Platform",
      role: UserRole.PLATFORM,
      availableCoins: 0,
      lockedCoins: 0,
    },
    session,
  );
}

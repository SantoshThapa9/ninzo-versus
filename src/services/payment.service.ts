import Razorpay from "razorpay";
import crypto from "crypto";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent, coinsToRupees } from "@/lib/utils";
import { getEnv, requireEnv } from "@/config/env";
import { paymentRepository } from "@/repositories/finance.repository";
import { applyLedger } from "@/services/wallet.service";
import { getPlatformSettings } from "@/services/settings.service";
import { CoinTxnType, PaymentStatus } from "@/types/enums";

function razorpayClient() {
  return new Razorpay({
    key_id: requireEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    key_secret: requireEnv("RAZORPAY_KEY_SECRET"),
  });
}

export async function createDepositOrder(userId: string, coins: number) {
  const settings = await getPlatformSettings();
  if (coins < settings.minDepositCoins) {
    throw new AppError(
      `Minimum NV Token purchase is ${settings.minDepositCoins} NV Tokens.`,
      "MIN_DEPOSIT",
    );
  }
  if (coins % 1 !== 0) {
    throw new AppError("NV Tokens must be a whole number.", "INVALID_COINS");
  }

  const rupees = coinsToRupees(coins, settings.nvCoinsPerRupee);
  const feeRupees = (rupees * settings.depositFeePercent) / 100;
  const totalRupees = rupees + feeRupees;
  const amountPaise = Math.round(totalRupees * 100);
  const feePaise = Math.round(feeRupees * 100);
  const idempotencyKey = `deposit:${userId}:${crypto.randomUUID()}`;

  await connectDb();
  const order = await razorpayClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    notes: { userId, coins: String(coins), idempotencyKey },
  });

  await paymentRepository.create({
    userId,
    coins,
    amountPaise,
    feePaise,
    razorpayOrderId: order.id,
    idempotencyKey,
  });

  return {
    orderId: order.id,
    amountPaise,
    coins,
    feePaise,
    keyId: getEnv().NEXT_PUBLIC_RAZORPAY_KEY_ID ?? getEnv().RAZORPAY_KEY_ID,
  };
}

export async function fulfillDeposit(orderId: string, paymentId: string, signature?: string) {
  await connectDb();
  const payment = await paymentRepository.findByOrderId(orderId);
  if (!payment) throw new AppError("Payment not found.", "NOT_FOUND", 404);
  if (payment.status === PaymentStatus.PAID) return payment;

  if (signature) {
    const expected = crypto
      .createHmac("sha256", requireEnv("RAZORPAY_KEY_SECRET"))
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    if (expected !== signature) {
      throw new AppError("Invalid payment signature.", "BAD_SIGNATURE", 400);
    }
  }

  return withTransaction(async (session) => {
    const fresh = await paymentRepository.findByOrderId(orderId, session);
    if (!fresh) throw new AppError("Payment not found.", "NOT_FOUND", 404);
    if (fresh.status === PaymentStatus.PAID) return fresh;
    fresh.status = PaymentStatus.PAID;
    fresh.razorpayPaymentId = paymentId;
    await fresh.save({ session });

    await applyLedger({
      userId: String(fresh.userId),
      type: CoinTxnType.DEPOSIT,
      amount: fresh.coins,
      availableDelta: fresh.coins,
      lockedDelta: 0,
      referenceType: "Payment",
      referenceId: String(fresh._id),
      idempotencyKey: `deposit-credit:${fresh.idempotencyKey}`,
      session,
    });
    return fresh;
  });
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const expected = crypto
    .createHmac("sha256", requireEnv("RAZORPAY_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

export function quoteDeposit(coins: number, settings: Awaited<ReturnType<typeof getPlatformSettings>>) {
  const rupees = coinsToRupees(coins, settings.nvCoinsPerRupee);
  const feeRupees = (rupees * settings.depositFeePercent) / 100;
  return {
    coins,
    rupees,
    feeRupees,
    totalRupees: rupees + feeRupees,
    feePercent: settings.depositFeePercent,
  };
}

export { applyPercent };

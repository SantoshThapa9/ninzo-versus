import crypto from "crypto";
import { connectDb, withTransaction } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors";
import { applyPercent, coinsToRupees, isValidTokenAmount } from "@/lib/utils";
import { getEnv, requireEnv } from "@/config/env";
import { paymentRepository } from "@/repositories/finance.repository";
import { userRepository } from "@/repositories/user.repository";
import { applyLedger } from "@/services/wallet.service";
import { CoinTxnType, PaymentStatus } from "@/types/enums";
import { ECONOMY_DEFAULTS } from "@/config/defaults";

const CASHFREE_API_VERSION = "2023-08-01";

function cashfreeMode() {
  const { CASHFREE_ENV } = getEnv();
  if (CASHFREE_ENV) return CASHFREE_ENV;
  return requireEnv("CASHFREE_CLIENT_ID").startsWith("TEST")
    ? "sandbox"
    : "production";
}

function cashfreeBaseUrl() {
  return cashfreeMode() === "sandbox"
    ? "https://sandbox.cashfree.com/pg"
    : "https://api.cashfree.com/pg";
}

function cashfreeHeaders(idempotencyKey?: string) {
  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": requireEnv("CASHFREE_CLIENT_ID"),
    "x-client-secret": requireEnv("CASHFREE_CLIENT_SECRET"),
    ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
  };
}

async function cashfreeRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${cashfreeBaseUrl()}${path}`, {
    ...init,
    headers: { ...cashfreeHeaders(), ...init.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Cashfree API request failed.", {
      status: response.status,
    });
    throw new AppError(
      "Token deposits are temporarily unavailable. Please try again later.",
      "CASHFREE_REQUEST_FAILED",
      502,
    );
  }
  return (await response.json()) as T;
}

function normalizePhoneNumber(phoneNumber: string) {
  let digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new AppError(
      "Update your profile with a valid Indian mobile number to continue with payment.",
      "INVALID_PHONE_NUMBER",
      400,
    );
  }
  return digits;
}

export async function createDepositOrder(
  userId: string,
  coins: number,
) {
  await connectDb();
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Account not found.", "NOT_FOUND", 404);
  if (!user.age || user.age < 18) {
    throw new AppError(
      "You must be 18 or older to deposit NV Tokens.",
      "AGE_RESTRICTED",
      403,
    );
  }
  if (!user.phoneNumber) {
    throw new AppError(
      "Add a phone number to your profile before depositing NV Tokens.",
      "PHONE_NUMBER_REQUIRED",
      400,
    );
  }
  const customerPhone = normalizePhoneNumber(user.phoneNumber);
  if (!isValidTokenAmount(coins)) {
    throw new AppError(
      "NV Tokens can have up to two decimal places.",
      "INVALID_COINS",
    );
  }
  if (coins < ECONOMY_DEFAULTS.minDepositCoins) {
    throw new AppError(
      `Minimum NV Token deposit is ${ECONOMY_DEFAULTS.minDepositCoins} NV Tokens.`,
      "MIN_DEPOSIT",
    );
  }
  const rupees = coinsToRupees(coins, ECONOMY_DEFAULTS.nvCoinsPerRupee);
  const feeRupees = (rupees * ECONOMY_DEFAULTS.depositFeePercent) / 100;
  const totalRupees = rupees + feeRupees;
  const amountPaise = Math.round(totalRupees * 100);
  const feePaise = Math.round(feeRupees * 100);
  const idempotencyKey = `deposit:${userId}:${crypto.randomUUID()}`;
  const orderId = `deposit_${crypto.randomUUID().replaceAll("-", "")}`;

  const order = await fetch(`${cashfreeBaseUrl()}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(crypto.randomUUID()),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: totalRupees,
      order_currency: "INR",
      customer_details: {
        customer_id: userId,
        customer_name: user.displayName,
        customer_email: user.email,
        customer_phone: customerPhone,
      },
    }),
  });
  if (!order.ok) {
    console.error("Cashfree could not create a deposit order.", {
      status: order.status,
    });
    throw new AppError(
      "Token deposits are temporarily unavailable. Please try again later.",
      "CASHFREE_ORDER_FAILED",
      502,
    );
  }
  const cashfreeOrder = (await order.json()) as {
    order_id: string;
    payment_session_id: string;
  };
  if (!cashfreeOrder.order_id || !cashfreeOrder.payment_session_id) {
    console.error("Cashfree returned an incomplete payment session.");
    throw new AppError(
      "Token deposits are temporarily unavailable. Please try again later.",
      "CASHFREE_INVALID_RESPONSE",
      502,
    );
  }

  await paymentRepository.create({
    userId,
    coins,
    amountPaise,
    feePaise,
    razorpayOrderId: cashfreeOrder.order_id,
    idempotencyKey,
  });

  return {
    orderId: cashfreeOrder.order_id,
    paymentSessionId: cashfreeOrder.payment_session_id,
    amountPaise,
    coins,
    feePaise,
    mode: cashfreeMode(),
  };
}

export async function fulfillDeposit(orderId: string, paymentId: string) {
  await connectDb();
  const payment = await paymentRepository.findByOrderId(orderId);
  if (!payment) throw new AppError("Payment not found.", "NOT_FOUND", 404);
  if (payment.status === PaymentStatus.PAID) return payment;

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

async function confirmCashfreeDeposit(orderId: string) {
  await connectDb();
  const payment = await paymentRepository.findByOrderId(orderId);
  if (!payment) throw new AppError("Payment not found.", "NOT_FOUND", 404);
  if (payment.status === PaymentStatus.PAID) return payment;

  const order = await cashfreeRequest<{
    order_id: string;
    order_amount: number;
    order_currency: string;
    order_status: string;
  }>(`/orders/${encodeURIComponent(orderId)}`);
  if (
    order.order_id !== orderId ||
    order.order_currency !== "INR" ||
    Math.round(Number(order.order_amount) * 100) !== payment.amountPaise
  ) {
    throw new AppError("Cashfree order details do not match.", "ORDER_MISMATCH", 400);
  }
  if (order.order_status !== "PAID") {
    throw new AppError("Payment is not confirmed yet.", "PAYMENT_PENDING", 409);
  }

  const payments = await cashfreeRequest<
    Array<{
      cf_payment_id?: string;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
    }>
  >(`/orders/${encodeURIComponent(orderId)}/payments`);
  const successfulPayment = payments.find(
    (item) =>
      item.payment_status === "SUCCESS" &&
      item.cf_payment_id &&
      item.payment_currency === "INR" &&
      Math.round(Number(item.payment_amount) * 100) === payment.amountPaise,
  );
  if (!successfulPayment?.cf_payment_id) {
    throw new AppError("Cashfree has not confirmed a successful payment.", "PAYMENT_PENDING", 409);
  }
  await fulfillDeposit(orderId, successfulPayment.cf_payment_id);
  return { status: PaymentStatus.PAID };
}

export async function verifyCashfreeDeposit(orderId: string, userId: string) {
  await connectDb();
  const payment = await paymentRepository.findByOrderId(orderId);
  if (!payment) throw new AppError("Payment not found.", "NOT_FOUND", 404);
  if (String(payment.userId) !== userId) {
    throw new AppError("Payment does not belong to this account.", "FORBIDDEN", 403);
  }
  return confirmCashfreeDeposit(orderId);
}

export function confirmCashfreeWebhookDeposit(orderId: string) {
  return confirmCashfreeDeposit(orderId);
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
) {
  if (!signature || !timestamp) return false;
  const expected = crypto
    .createHmac("sha256", requireEnv("CASHFREE_CLIENT_SECRET"))
    .update(`${timestamp}${rawBody}`)
    .digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function quoteDeposit(coins: number) {
  const rupees = coinsToRupees(coins, ECONOMY_DEFAULTS.nvCoinsPerRupee);
  const feeRupees = (rupees * ECONOMY_DEFAULTS.depositFeePercent) / 100;
  return {
    coins,
    rupees,
    feeRupees,
    totalRupees: rupees + feeRupees,
    feePercent: ECONOMY_DEFAULTS.depositFeePercent,
  };
}

export { applyPercent };

import { NextRequest } from "next/server";
import {
  confirmCashfreeWebhookDeposit,
  verifyCashfreeWebhookSignature,
} from "@/services/payment.service";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature") ?? "";
    const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
    if (!verifyCashfreeWebhookSignature(rawBody, signature, timestamp)) {
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        order?: { order_id?: string };
        payment?: { payment_status?: string };
      };
    };
    const orderId = event.data?.order?.order_id;
    if (
      event.type === "PAYMENT_SUCCESS_WEBHOOK" &&
      event.data?.payment?.payment_status === "SUCCESS" &&
      orderId &&
      /^deposit_[a-f0-9]{32}$/.test(orderId)
    ) {
      await confirmCashfreeWebhookDeposit(orderId);
    }
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

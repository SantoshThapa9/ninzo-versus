import { NextRequest } from "next/server";
import {
  fulfillDeposit,
  verifyWebhookSignature,
} from "@/services/payment.service";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    if (!verifyWebhookSignature(raw, signature)) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    const payload = JSON.parse(raw) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    if (payload.event === "payment.captured") {
      const entity = payload.payload?.payment?.entity;
      if (entity?.id && entity.order_id) {
        await fulfillDeposit(entity.order_id, entity.id);
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

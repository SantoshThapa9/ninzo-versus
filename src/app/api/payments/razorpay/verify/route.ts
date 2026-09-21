import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { fulfillDeposit } from "@/services/payment.service";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };
    await fulfillDeposit(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

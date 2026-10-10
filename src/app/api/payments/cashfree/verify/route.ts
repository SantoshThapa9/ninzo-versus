import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { verifyCashfreeDeposit } from "@/services/payment.service";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { orderId?: unknown };
    if (typeof body.orderId !== "string" || !/^deposit_[a-f0-9]{32}$/.test(body.orderId)) {
      return Response.json({ error: "Invalid order ID." }, { status: 400 });
    }
    await verifyCashfreeDeposit(body.orderId, session.user.id);
    return Response.json({ ok: true });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

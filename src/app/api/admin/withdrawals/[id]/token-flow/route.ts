import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { getWithdrawalTokenFlow } from "@/services/withdrawal.service";
import { UserRole } from "@/types/enums";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (session?.user?.role !== UserRole.ADMIN) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    return NextResponse.json(await getWithdrawalTokenFlow(id, cursor));
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: error instanceof AppError ? error.status : 500 });
  }
}

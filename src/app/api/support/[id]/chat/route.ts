import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getSupportChat, sendTicketMessage } from "@/services/support.service";
import { UserRole } from "@/types/enums";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    return Response.json(await getSupportChat(session.user.id, id, session.user.role === UserRole.ADMIN));
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await rateLimit(`support:chat:${session.user.id}`, 30, 60);
    const { id } = await ctx.params;
    const payload = (await request.json()) as { body?: string };
    const message = await sendTicketMessage(session.user.id, id, payload.body ?? "", session.user.role === UserRole.ADMIN);
    return Response.json({ ok: true, message: JSON.parse(JSON.stringify(message)) });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getMatchChat, sendMatchChatMessage } from "@/services/match-chat.service";

export async function GET(_request: Request, ctx: RouteContext<"/api/clash/[id]/chat">) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    return Response.json(await getMatchChat(session.user.id, id));
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/clash/[id]/chat">) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await rateLimit(`match:chat:${session.user.id}`, 30, 60);
    const { id } = await ctx.params;
    const payload = (await request.json()) as { body?: string };
    const message = await sendMatchChatMessage(session.user.id, id, payload.body ?? "");
    return Response.json({ ok: true, message: JSON.parse(JSON.stringify(message)) });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

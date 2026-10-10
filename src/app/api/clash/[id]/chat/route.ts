import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  getMatchChat,
  sendMatchChatMessage,
  setMatchChatNotificationsMuted,
} from "@/services/match-chat.service";
import { notifyMatchChatMessage } from "@/services/push-notification.service";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/clash/[id]/chat">,
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const searchParams = new URL(request.url).searchParams;
    const afterValue = searchParams.get("after");
    const afterId = searchParams.get("afterId");
    const hasAfter = searchParams.has("after");
    const hasAfterId = searchParams.has("afterId");
    const afterDate = afterValue ? new Date(afterValue) : undefined;
    if (
      hasAfter !== hasAfterId ||
      (hasAfter &&
        (!afterValue ||
          !afterId ||
          !/^[a-f\d]{24}$/i.test(afterId) ||
          !afterDate ||
          Number.isNaN(afterDate.getTime())))
    ) {
      return Response.json(
        { error: "Invalid message cursor." },
        { status: 400 },
      );
    }
    const after =
      afterDate && afterId ? { createdAt: afterDate, id: afterId } : undefined;
    const { id } = await ctx.params;
    return Response.json(await getMatchChat(session.user.id, id, after));
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/clash/[id]/chat">,
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    await rateLimit(`match:chat:${session.user.id}`, 10, 60);
    const { id } = await ctx.params;
    const payload = (await request.json()) as { body?: string };
    const message = await sendMatchChatMessage(
      session.user.id,
      id,
      payload.body ?? "",
    );
    const { recipientId, recipientHasMutedChat, ...publicMessage } = message;
    if (!recipientHasMutedChat && !message.senderOnly) {
      // Notification delivery is intentionally best-effort: a sent message
      // must never fail because a recipient revoked their push permission.
      void notifyMatchChatMessage(
        recipientId,
        message.senderName,
        id,
        String(message._id),
        message.body,
      ).catch((error) =>
        console.error("[push] Failed to queue match chat notification.", {
          matchId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return Response.json({
      ok: true,
      message: JSON.parse(JSON.stringify(publicMessage)),
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/clash/[id]/chat">,
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const payload = (await request.json()) as { muted?: unknown };
    if (typeof payload.muted !== "boolean") {
      return Response.json({ error: "Invalid mute setting." }, { status: 400 });
    }
    return Response.json(
      await setMatchChatNotificationsMuted(session.user.id, id, payload.muted),
    );
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

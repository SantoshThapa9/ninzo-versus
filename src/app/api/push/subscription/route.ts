import { auth } from "@/auth";
import { removePushSubscription, savePushSubscription } from "@/services/push-notification.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await savePushSubscription(session.user.id, await request.json());
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!body || typeof body.endpoint !== "string") {
    return Response.json({ error: "Invalid subscription endpoint." }, { status: 400 });
  }
  await removePushSubscription(session.user.id, body.endpoint);
  return Response.json({ ok: true });
}

import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { AndroidAuthHandoffModel } from "@/models/android-auth-handoff";

const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF_LIFETIME_MS = 2 * 60 * 1000;
const APP_CALLBACK_URI = "com.ninzoversus.app://auth/callback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return new Response("Invalid request origin.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid Android authentication handoff.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (typeof body !== "object" || body === null) {
    return new Response("Invalid Android authentication handoff.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { challenge, state } = body as {
    challenge?: unknown;
    state?: unknown;
  };
  if (
    typeof challenge !== "string" ||
    typeof state !== "string" ||
    !BASE64URL_32_BYTES.test(challenge) ||
    !BASE64URL_32_BYTES.test(state)
  ) {
    return new Response("Invalid Android authentication handoff.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Authentication required.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ticket = randomBytes(32).toString("base64url");
  await connectDb();
  await AndroidAuthHandoffModel.create({
    ticketHash: createHash("sha256").update(ticket).digest("hex"),
    codeChallenge: challenge,
    userId,
    expiresAt: new Date(Date.now() + HANDOFF_LIFETIME_MS),
  });

  const callbackUrl = new URL(APP_CALLBACK_URI);
  callbackUrl.searchParams.set("code", ticket);
  callbackUrl.searchParams.set("state", state);

  return Response.json(
    { callbackUrl: callbackUrl.toString() },
    {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

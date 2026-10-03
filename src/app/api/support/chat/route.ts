import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supportChatReply } from "@/services/ai.service";

type ChatHistoryItem = { sender: "user" | "assistant"; body: string };

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as {
      message?: string;
      history?: ChatHistoryItem[];
    };
    const message = (body.message ?? "").trim();
    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (item): item is ChatHistoryItem =>
              (item.sender === "user" || item.sender === "assistant") &&
              typeof item.body === "string",
          )
          .slice(-20)
          .map((item) => ({
            sender: item.sender,
            body: item.body.trim().slice(0, 4000),
          }))
      : [];

    if (!message) {
      return NextResponse.json(
        { error: "Please type a message first." },
        { status: 400 },
      );
    }
    if (message.length > 4000 || history.length > 10) {
      return NextResponse.json(
        {
          error:
            "This conversation is too long. Please start a new support chat.",
        },
        { status: 413 },
      );
    }

    const reply = await supportChatReply(
      history.length ? history : [{ sender: "user", body: message }],
    );
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Support chat is unavailable right now." },
      { status: 500 },
    );
  }
}

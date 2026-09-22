import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { SupportTicketModel } from "@/models/support-ticket";
import { ReportType, SupportStatus } from "@/types/enums";
import { supportAiReply } from "@/services/ai.service";

type ChatHistoryItem = { sender: "user" | "assistant"; body: string };

function detectCategory(summary: string): ReportType {
  const text = summary.toLowerCase();
  if (text.includes("payment") || text.includes("wallet") || text.includes("deposit") || text.includes("refund")) {
    return ReportType.PAYMENT_ISSUE;
  }
  if (text.includes("match") || text.includes("result") || text.includes("cheat") || text.includes("dispute")) {
    return ReportType.MATCH_DISPUTE;
  }
  if (text.includes("login") || text.includes("account") || text.includes("password")) {
    return ReportType.HACKING;
  }
  return ReportType.MATCH_DISPUTE;
}

function extractWhatsAppNumber(value: string) {
  const matches = value.match(/\+?\d[\d\s()+-]{7,}\d/g);
  if (!matches) return null;

  const candidate = matches[0].replace(/\s+/g, "").replace(/[()+-]/g, "");
  return /^\d{8,15}$/.test(candidate) ? candidate : null;
}

function findWhatsAppProvidedAfterPrompt(history: ChatHistoryItem[]) {
  let requestedAt = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry.sender === "assistant" && /whatsapp/i.test(entry.body)) {
      requestedAt = index;
      break;
    }
  }

  if (requestedAt === -1) return null;
  return history
    .slice(requestedAt + 1)
    .filter((entry) => entry.sender === "user")
    .map((entry) => extractWhatsAppNumber(entry.body))
    .find(Boolean) ?? null;
}

function isConfirmation(value: string) {
  return /^(confirm|confirmed|yes|y|correct|that's correct|that is correct)\b/i.test(value.trim());
}

async function saveTicketForAdmin(userId: string, summary: string, whatsappNumber: string) {
  await connectDb();
  const category = detectCategory(summary);

  await SupportTicketModel.create({
    userId,
    category,
    status: SupportStatus.PENDING_ADMIN,
    whatsappNumber,
    summary: summary.trim(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; history?: ChatHistoryItem[] };
    const message = (body.message ?? "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "Please type a message first." }, { status: 400 });
    }

    const userMessages = history.filter((entry) => entry.sender === "user").map((entry) => entry.body.trim());
    const summary = userMessages.join(" ").trim();
    const priorHistory = history.slice(0, -1);
    const previousAssistant = priorHistory.at(-1);
    const requestedConfirmation = previousAssistant?.sender === "assistant" && /reply confirm/i.test(previousAssistant.body);
    const currentNumber = previousAssistant?.sender === "assistant" && /whatsapp/i.test(previousAssistant.body)
      ? extractWhatsAppNumber(message)
      : null;
    const suppliedWhatsApp = currentNumber ?? findWhatsAppProvidedAfterPrompt(priorHistory);

    if (requestedConfirmation && suppliedWhatsApp && isConfirmation(message)) {
      const userId = (await auth())?.user?.id;
      const finalSummary = summary.replace(/\+?\d[\d\s()+-]{7,}\d/g, "").replace(/\b(confirm|confirmed|yes|y|correct)\b/gi, "").trim() || "Support request";

      if (userId && finalSummary.trim()) {
        await saveTicketForAdmin(userId, finalSummary, suppliedWhatsApp);
      }

      return NextResponse.json({
        reply: "Thank you. Your support request has been saved. We will contact you on WhatsApp if needed. This chat is now closed.",
        closed: true,
      });
    }

    if (suppliedWhatsApp) {
      return NextResponse.json({
        reply: `Please confirm: should we use WhatsApp number ${suppliedWhatsApp}? Reply CONFIRM to submit, or send the correct number.`,
      });
    }

    const hasIssueSummary = summary.length >= 12;
    const ai = await supportAiReply({
      summary,
      category: detectCategory(summary || message),
      history: history.length ? history : [{ sender: "user", body: message }],
      missing: hasIssueSummary ? ["any missing match or issue details, then WhatsApp number"] : ["full issue details"],
    });

    const reply =
      ai.reply ||
      (hasIssueSummary
        ? "Thanks. Please share your WhatsApp number so we can confirm it and close this request."
        : "Please describe the issue and include all relevant details: match time, match or room ID, opponent name, what happened, and any payment or account details.");

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "Support chat is unavailable right now." }, { status: 500 });
  }
}

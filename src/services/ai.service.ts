import OpenAI from "openai";
import { getEnv } from "@/config/env";
import { getPlatformSettings } from "@/services/settings.service";
import { ReportType } from "@/types/enums";

function client() {
  const key = getEnv().OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export type VisionResult = {
  ign?: string;
  uid?: string;
  scores?: string;
  winner?: string;
  matchDetails?: string;
  confidence?: number;
  raw?: unknown;
};

export async function analyzeMatchScreenshot(imageUrl: string): Promise<VisionResult | undefined> {
  const settings = await getPlatformSettings();
  if (!settings.visionEnabled) return undefined;
  const openai = client();
  if (!openai) return undefined;

  const response = await openai.responses.create({
    model: settings.visionModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract Free Fire match screenshot details as JSON with keys: ign, uid, scores, winner, matchDetails, confidence (0-1). This is assistive only.",
          },
          { type: "input_image", image_url: imageUrl, detail: "auto" },
        ],
      },
    ],
  });

  const text = response.output_text ?? "";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as VisionResult;
    return { ...parsed, raw: parsed };
  } catch {
    return { matchDetails: text, confidence: 0.2, raw: text };
  }
}

export async function supportAiReply(params: {
  summary: string;
  category: ReportType;
  history: { sender: string; body: string }[];
  missing?: string[];
}) {
  const settings = await getPlatformSettings();
  if (!settings.supportAiEnabled) {
    return {
      reply:
        "An admin will take this from here. Please share Match ID, Free Fire UID, IGN, screenshots, and a video if possible.",
      escalate: true,
      category: params.category,
    };
  }
  const openai = client();
  if (!openai) {
    return {
      reply:
        "Thanks, I logged this. Please add Match ID, Free Fire UID, IGN, screenshots, and a recommended video. An admin will review if needed.",
      escalate: true,
      category: params.category,
    };
  }

  const response = await openai.responses.create({
    model: settings.chatModel,
    input: [
      {
        role: "system",
        content: `You are Ninzo Versus support for a Free Fire India platform. Categorize issues, ask for missing Match ID, UID, IGN, screenshots, and video. Never promise payouts, bans, or winner decisions. JSON: { "reply": string, "category": string, "escalate": boolean }`,
      },
      {
        role: "user",
        content: JSON.stringify(params),
      },
    ],
  });

  try {
    return JSON.parse((response.output_text ?? "").replace(/```json|```/g, "").trim()) as {
      reply: string;
      category: ReportType;
      escalate: boolean;
    };
  } catch {
    return {
      reply: response.output_text ?? "Please share more match evidence so an admin can review.",
      category: params.category,
      escalate: true,
    };
  }
}

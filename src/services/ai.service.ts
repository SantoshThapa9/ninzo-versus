import OpenAI from "openai";
import { getEnv } from "@/config/env";
import { getPlatformSettings } from "@/services/settings.service";
import { getPrivateImageDataUrl } from "@/services/media.service";
import { ReportType } from "@/types/enums";

function client() {
  const key = getEnv().OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function logVisionRequestError(error: unknown, model: string) {
  const details: Record<string, unknown> = { model };
  if (error instanceof Error) {
    details.name = error.name;
    details.message = error.message;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    details.status = (error as { status?: unknown }).status;
  }
  console.error("[match-ai] Vision request failed.", details);
}

export type VisionResult = {
  roomId?: string;
  winnerIGN?: string;
  confidence?: number;
  raw?: unknown;
};

const permanentTeamNames = new Set(["WARBRINGERS", "HOWLERS"]);

function normalizeWinnerIgn(value: unknown) {
  if (typeof value !== "string") return undefined;
  const ign = value.trim();
  if (!ign || permanentTeamNames.has(ign.toLocaleUpperCase())) return undefined;
  return ign;
}

function extractRoomIdBeforeHash(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLocaleUpperCase().replace(/[^A-Z0-9#]/g, "");
  // The model is instructed to return only the seven-character room ID. Do
  // not require it to repeat the '#' delimiter from the screenshot.
  if (/^\d{7}$/.test(normalized)) return normalized;
  const hashIndex = normalized.indexOf("#");
  if (hashIndex === -1) return undefined;
  return normalized.slice(0, hashIndex).match(/\d{7}$/)?.[0];
}

export type MatchValidation = {
  valid?: boolean;
  winner?: string;
  reason?: string;
};

/** Third and final AI call: validates saved extractions only, never re-reads images. */
export async function validateMatchExtractions(input: {
  first: VisionResult;
  second: VisionResult;
  players: string[];
  question?: string;
  winnerUserId?: string;
}): Promise<MatchValidation | undefined> {
  const settings = await getPlatformSettings();
  const openai = client();
  if (!settings.visionEnabled || !openai) return undefined;
  const model = settings.visionModel || "gpt-5.6-luna";
  const comparisonQuestion =
    input.question ??
    `Do both screenshots match the same final result and same winner for these players? Use the extracted roomId and winnerIGN values only. If the winner is not clearly the same in both screenshots, return valid=false.`;
  try {
    const response = await openai.responses.create({
      model,
      store: false,
      input: `Use plain-text JSON only. ${comparisonQuestion} Ignore case and symbols in names; accept clipped or partial IGN matches. Return only JSON {"valid":true|false,"winner":"player name or empty","reason":"short"}. Data: ${JSON.stringify(
        {
          ...input,
          winnerUserId: input.winnerUserId ?? input.players[0] ?? "",
        },
      )}`,
    });
    return JSON.parse(
      (response.output_text ?? "").replace(/```json|```/g, "").trim(),
    ) as MatchValidation;
  } catch (error) {
    logVisionRequestError(error, model);
    return undefined;
  }
}

export async function analyzeMatchScreenshot(
  blobPathname: string,
  playerIgns: string[] = [],
): Promise<VisionResult | undefined> {
  const settings = await getPlatformSettings();
  console.info("[match-ai] Starting screenshot analysis.");
  if (!settings.visionEnabled) {
    console.warn("[match-ai] Screenshot analysis skipped: vision is disabled.");
    return undefined;
  }
  const openai = client();
  if (!openai) {
    console.warn(
      "[match-ai] Screenshot analysis skipped: OpenAI API key is missing.",
    );
    return undefined;
  }

  let response;
  const model = "gpt-5.6-luna";
  try {
    const imageUrl = await getPrivateImageDataUrl(blobPathname);
    console.info("[match-ai] Sending private screenshot to the vision model.");
    response = await openai.responses.create({
      model,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "free_fire_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              roomId: {
                type: "string",
                description:
                  "Exactly the seven digits before # in the Custom Room ID, or an empty string if unreadable.",
              },
              winnerIgn: {
                type: "string",
                description:
                  "Winner's player IGN from the NAME list, or an empty string if unreadable.",
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["roomId", "winnerIgn", "confidence"],
            additionalProperties: false,
          },
        },
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: 'Analyze only this Free Fire final-result screenshot and return pure JSON: {"roomId":"","winnerIgn":"","confidence":0}. Read the Custom Room ID only from the bottom-left corner and ignore FPS, icons, overlays, and every other text. Extract ONLY the 7 alphanumeric characters immediately before \'#\' as roomId (never include \'#\' or anything after it). Extract winnerIgn only from the winning player\'s NAME row; WARBRINGERS and HOWLERS are permanent team names and must never be returned. If a value is unreadable, return an empty string and lower confidence.',
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
    });
  } catch (error) {
    logVisionRequestError(error, model);
    throw error;
  }

  const text = response.output_text ?? "";
  try {
    const parsed = JSON.parse(
      text.replace(/```json|```/g, "").trim(),
    ) as VisionResult & { winnerIgn?: unknown };
    const winnerIGN = normalizeWinnerIgn(parsed.winnerIgn ?? parsed.winnerIGN);
    const result: VisionResult = {
      // Keep only the seven characters immediately before #. In particular,
      // never fall back to text after # when the model returns a malformed ID.
      roomId: extractRoomIdBeforeHash(parsed.roomId),
      winnerIGN,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      raw: parsed,
    };
    console.info("[match-ai] Screenshot analysis completed.", {
      hasRoomId: Boolean(result.roomId),
      hasWinnerIgn: Boolean(result.winnerIGN),
      confidence: result.confidence,
    });
    return result;
  } catch {
    console.warn(
      "[match-ai] Vision response was not valid JSON; marking screenshot inconclusive.",
    );
    return { confidence: 0, raw: text };
  }
}

export async function supportAiReply(params: {
  summary: string;
  category: ReportType;
  history: { sender: string; body: string }[];
  missing?: string[];
}) {
  const settings = await getPlatformSettings();
  const model = settings.chatModel ?? "gpt-5-nano";

  if (!settings.supportAiEnabled) {
    return {
      reply:
        "Please tell us briefly what happened, and then share your WhatsApp number so the admin team can contact you.",
      escalate: true,
      category: params.category,
    };
  }

  const openai = client();
  if (!openai) {
    return {
      reply:
        "Please tell us briefly what happened, and then share your WhatsApp number so the admin team can contact you.",
      escalate: true,
      category: params.category,
    };
  }

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You are a professional support-intake assistant for a gaming platform. Keep replies short, warm, and human. Your goal is to gather the complete report before asking for WhatsApp. On the first reply, ask the user to send all relevant details together: what happened, match date/time, match or room ID if known, opponent/player name, what the opponent did, their UID/IGN if relevant, and payment/account details if relevant. On later replies, identify every important missing detail and ask for them together in one message; do not drip-feed questions one at a time. Once the report is sufficiently clear, ask only for the user's WhatsApp number. Do not ask them to confirm it: the application handles confirmation. Never promise a refund, ban, reward, or match result.",
      },
      {
        role: "user",
        content: JSON.stringify({
          summary: params.summary,
          category: params.category,
          history: params.history,
          missing: params.missing,
        }),
      },
    ],
  });

  try {
    const text = response.output_text ?? "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      reply?: string;
      category?: ReportType;
      escalate?: boolean;
    };

    return {
      reply:
        parsed.reply ||
        text ||
        "Please tell us briefly what happened, and then share your WhatsApp number.",
      category: parsed.category ?? params.category,
      escalate: Boolean(parsed.escalate),
    };
  } catch {
    return {
      reply:
        response.output_text ||
        "Please tell us briefly what happened, and then share your WhatsApp number.",
      category: params.category,
      escalate: true,
    };
  }
}

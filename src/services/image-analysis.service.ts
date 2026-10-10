import { AI_DEFAULTS } from "@/config/defaults";
import { getPrivateImageDataUrl } from "@/services/media.service";
import {
  parseScreenshotResult,
  type ScreenshotResult,
} from "@/services/match-evidence-rules";
import { getOpenAIClient } from "./openai.client.service";

export async function analyzeMatchScreenshot(
  blobPathname: string,
): Promise<ScreenshotResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OpenAI API key is missing.");
  }

  const imageUrl = await getPrivateImageDataUrl(blobPathname);
  const response = await openai.responses.create({
    model: AI_DEFAULTS.visionModel,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "match_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            result: {
              type: "string",
              enum: ["VICTORY", "DEFEAT", "UNREADABLE"],
            },
          },
          required: ["result"],
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
            text: `Inspect only the match-result banner around the upper-center of the screenshot. Return VICTORY or DEFEAT when clearly readable. Return UNREADABLE if the screenshot or result banner cannot be read, is missing, or does not show a clear result.`,
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "low",
          },
        ],
      },
    ],
  });

  const output = response.output_text ?? "";
  let result: ScreenshotResult;
  try {
    const parsed = JSON.parse(output) as { result?: unknown };
    result = parseScreenshotResult(parsed.result);
  } catch {
    result = parseScreenshotResult(output);
  }
  if (result === "UNREADABLE") {
    console.warn(
      "[match-ai] Vision could not read a clear result from the screenshot.",
    );
  }
  return result;
}

import OpenAI from "openai";

import { getEnv } from "@/config/env";

export function getOpenAIClient() {
  const key = getEnv().OPENAI_API_KEY;

  if (!key) return null;

  return new OpenAI({
    apiKey: key,
  });
}

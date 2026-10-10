import { BLOCKED_WORDS_TEXT } from "@/config/defaults";

const RESPECT_WARNING = "Please be respectful or your account will be banned.";

export const MUTED_CHAT_BODY = "Message muted";

// Convert the text into a Set once when this module loads.
const BLOCKED_WORDS = new Set(
  BLOCKED_WORDS_TEXT.toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean),
);

export function isAbusiveChatMessage(text: string): boolean {
  let start = -1;

  for (let i = 0; i <= text.length; i++) {
    const code = i < text.length ? text.charCodeAt(i) : 32;

    const isWordChar =
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 95;

    if (isWordChar) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      if (BLOCKED_WORDS.has(text.slice(start, i).toLowerCase())) {
        return true;
      }

      start = -1;
    }
  }

  return false;
}

export function isMutedChatMessage(text: string): boolean {
  return text === MUTED_CHAT_BODY || isAbusiveChatMessage(text);
}

export function publicChatBody(text: string): string {
  return isAbusiveChatMessage(text) ? MUTED_CHAT_BODY : text;
}

export function isSenderOnlyChatMessage(
  body: string,
  senderOnly?: boolean,
): boolean {
  return Boolean(senderOnly) || isMutedChatMessage(body);
}

export { RESPECT_WARNING };

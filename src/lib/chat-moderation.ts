const RESPECT_WARNING = "Please be respectful or your account will be banned.";

export const MUTED_CHAT_BODY = "Message muted";

/** Whole-word only — these also appear inside ordinary English. */
const SHORT_TERMS = ["abe", "abey", "sale", "saale", "salle"];

const COMPACT_TERMS = [
  "maderchod",
  "madarchod",
  "madrchod",
  "madarchoud",
  "motherchod",
  "randi",
  "rande",
  "randwa",
  "kutte",
  "kutta",
  "vosri",
  "vosdi",
  "bhosdi",
  "bhosdike",
  "bhosadi",
  "bhosadike",
  "boor",
  "fuck",
  "fck",
  "fuk",
  "fucker",
  "fucking",
  "vagina",
  "chut",
  "choot",
  "chutiya",
  "land",
  "laude",
  "lauda",
  "laura",
  "laure",
];

function fold(text: string) {
  return text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[4@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[$5]/g, "s");
}

function compactLetters(text: string) {
  return fold(text).replace(/[^a-z]/g, "");
}

function collapseRepeats(text: string) {
  return text.replace(/(.)\1+/g, "$1");
}

function hasWholeWord(folded: string, term: string) {
  const pattern = new RegExp(`(?:^|[^a-z])${term}(?:[^a-z]|$)`);
  return pattern.test(folded);
}

export function isAbusiveChatMessage(text: string) {
  const folded = fold(text);
  if (SHORT_TERMS.some((term) => hasWholeWord(folded, term))) return true;

  const compact = compactLetters(text);
  const collapsed = collapseRepeats(compact);
  return COMPACT_TERMS.some((term) => {
    const collapsedTerm = collapseRepeats(term);
    return compact.includes(term) || collapsed.includes(collapsedTerm);
  });
}

export function isMutedChatMessage(text: string) {
  return text === MUTED_CHAT_BODY || isAbusiveChatMessage(text);
}

export function publicChatBody(text: string) {
  return isAbusiveChatMessage(text) ? MUTED_CHAT_BODY : text;
}

export function isSenderOnlyChatMessage(body: string, senderOnly?: boolean) {
  return Boolean(senderOnly) || isMutedChatMessage(body);
}

export { RESPECT_WARNING };

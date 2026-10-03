"use client";

import { useSyncExternalStore, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
};

const CHAT_STORAGE_KEY = "ninzo-support-chat";

function makeMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    text,
  };
}

function welcomeMessage(): ChatMessage {
  return makeMessage(
    "assistant",
    "Hi! I’m Ninzo AI 👋 Chat in Hindi, English, or any language you prefer.",
  );
}

/**
 * localStorage external store
 */
function getSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(CHAT_STORAGE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === CHAT_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
}

function readMessages(snapshot: string): ChatMessage[] {
  if (!snapshot) {
    return [welcomeMessage()];
  }

  try {
    const parsed = JSON.parse(snapshot) as ChatMessage[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [welcomeMessage()];
    }

    return parsed;
  } catch {
    return [welcomeMessage()];
  }
}

export function SupportChatbot() {
  const storedChat = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const messages = readMessages(storedChat);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function saveMessages(nextMessages: ChatMessage[]) {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextMessages));

    // `storage` does not fire in the same tab, so manually notify
    // the external store that localStorage has changed.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CHAT_STORAGE_KEY,
        newValue: JSON.stringify(nextMessages),
      }),
    );
  }

  function startNewChat() {
    if (loading) return;

    localStorage.removeItem(CHAT_STORAGE_KEY);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CHAT_STORAGE_KEY,
        newValue: null,
      }),
    );

    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const text = message.trim();

    if (!text || loading) return;

    const userMessage = makeMessage("user", text);
    const nextMessages = [...messages, userMessage];

    saveMessages(nextMessages);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          history: nextMessages.map((item) => ({
            sender: item.sender,
            body: item.text,
          })),
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      const assistantMessage = makeMessage(
        "assistant",
        data.reply || data.error || "I could not answer that yet.",
      );

      saveMessages([...nextMessages, assistantMessage]);
    } catch {
      const errorMessage = makeMessage(
        "assistant",
        "The support service is temporarily unavailable. Please try again in a moment.",
      );

      saveMessages([...nextMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101113]/90 shadow-2xl shadow-black/30">
      <section className="flex min-h-[520px] flex-col bg-[#0b0d10]">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Ninzo AI</p>
            <h3 className="text-base font-semibold">Support chat</h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              Online
            </span>

            <button
              type="button"
              onClick={startNewChat}
              disabled={loading}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              New chat
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {messages.map((item) => (
            <div
              key={item.id}
              className={`flex ${
                item.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[95%] rounded-2xl px-3 pr-2 py-3 text-sm leading-6 shadow-sm ${
                  item.sender === "user"
                    ? "bg-[var(--accent)] text-black"
                    : "border border-white/10 bg-white/5 text-white"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {item.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                Thinking...
              </div>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 bg-[#101317] p-3"
        >
          <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 md:flex-row md:items-end">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              placeholder="Type your message..."
              className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

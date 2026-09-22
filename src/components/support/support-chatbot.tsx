"use client";

import { useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
};

type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

function makeMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    text,
  };
}

const defaultThread: ChatThread = {
  id: "chat-1",
  title: "Support",
  messages: [
    makeMessage(
      "assistant",
      "Hi! Tell me what happened and include all details you have in one message: match time or ID, opponent name, what they did, and any relevant payment or account details.",
    ),
  ],
};

export function SupportChatbot() {
  const [threads, setThreads] = useState<ChatThread[]>([defaultThread]);
  const [activeThreadId, setActiveThreadId] = useState(defaultThread.id);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  function createNewChat() {
    const id = `chat-${Date.now()}`;
    const nextThread: ChatThread = {
      id,
      title: "New chat",
      messages: [
        makeMessage("assistant", "New chat started. Tell me what happened and include the match time or ID, opponent name, what they did, and any relevant payment or account details."),
      ],
    };

    setThreads((current) => [nextThread, ...current]);
    setActiveThreadId(id);
    setMessage("");
    setChatClosed(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || !activeThread || chatClosed) return;

    const userMessage = makeMessage("user", text);
    const nextMessages = [...activeThread.messages, userMessage];

    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              title:
                thread.title === "New chat" && thread.messages.length > 0
                  ? text.length > 24
                    ? `${text.slice(0, 24)}...`
                    : text
                  : thread.title,
              messages: nextMessages,
            }
          : thread,
      ),
    );

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.map((item) => ({
            sender: item.sender,
            body: item.text,
          })),
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string; closed?: boolean };
      const assistantReply = data.reply || data.error || "I could not answer that yet.";

      if (data.closed) {
        setChatClosed(true);
      }

      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThread.id
            ? { ...thread, messages: [...thread.messages, makeMessage("assistant", assistantReply)] }
            : thread,
        ),
      );
    } catch {
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThread.id
            ? {
                ...thread,
                messages: [
                  ...thread.messages,
                  makeMessage("assistant", "The support service is temporarily unavailable. Please try again in a moment."),
                ],
              }
            : thread,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101113]/90 shadow-2xl shadow-black/30">
      <div className="flex min-h-[520px] flex-col md:flex-row">
        <aside className="w-full border-b border-white/10 bg-[#111417] md:w-[280px] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold">Chats</h2>
            <button
              type="button"
              onClick={createNewChat}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10"
            >
              New chat
            </button>
          </div>

          <div className="space-y-2 p-3">
            {threads.map((thread) => {
              const preview = thread.messages[thread.messages.length - 1]?.text ?? "New chat";
              const isActive = thread.id === activeThreadId;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-white/5 bg-black/10 hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{thread.title}</p>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{preview}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex flex-1 flex-col bg-[#0b0d10]">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm text-[var(--muted)]">Ninzo AI</p>
              <h3 className="text-base font-semibold">{activeThread.title}</h3>
            </div>
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              Online
            </span>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {activeThread.messages.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    item.sender === "user"
                      ? "bg-[var(--accent)] text-black"
                      : "border border-white/10 bg-white/5 text-white"
                  }`}
                >
                  {item.text}
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

          <form onSubmit={handleSubmit} className="border-t border-white/10 bg-[#101317] p-3">
            {chatClosed ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                This chat is closed. Your request has been saved.
              </div>
            ) : (
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
            )}
          </form>
        </section>
      </div>
    </div>
  );
}

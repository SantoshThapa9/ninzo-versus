"use client";

import { useState } from "react";

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
};

function makeMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return { id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, sender, text };
}

function welcomeMessage() {
  return makeMessage(
    "assistant",
    "Hi! I’m Ninzo AI. Ask me anything about using the app and I’ll explain what to do and how to do it. For an issue that needs a team member, use Support → New → Report an Issue.",
  );
}

export function SupportChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage()]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function startNewChat() {
    if (loading) return;
    setMessages([welcomeMessage()]);
    setMessage("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    const userMessage = makeMessage("user", text);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextMessages.map((item) => ({ sender: item.sender, body: item.text })),
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      setMessages((current) => [
        ...current,
        makeMessage("assistant", data.reply || data.error || "I could not answer that yet."),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        makeMessage("assistant", "The support service is temporarily unavailable. Please try again in a moment."),
      ]);
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
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">Online</span>
            <button type="button" onClick={startNewChat} disabled={loading} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
              New chat
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((item) => (
            <div key={item.id} className={`flex ${item.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${item.sender === "user" ? "bg-[var(--accent)] text-black" : "border border-white/10 bg-white/5 text-white"}`}>
                {item.text}
              </div>
            </div>
          ))}
          {loading ? <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">Thinking...</div></div> : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/10 bg-[#101317] p-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 md:flex-row md:items-end">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder="Type your message..." className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/35" />
            <button type="submit" disabled={loading || !message.trim()} className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">Send</button>
          </div>
        </form>
      </section>
    </div>
  );
}

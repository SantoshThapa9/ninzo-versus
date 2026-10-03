"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

type Message = {
  _id: string;
  sender: "user" | "admin" | "ai";
  body: string;
  createdAt: string;
};
type Evidence = { _id: string; imageUrl: string };

export function SupportTicketChat({
  ticketId,
  isAdmin,
}: {
  ticketId: string;
  isAdmin: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [ticketStatus, setTicketStatus] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Loading conversation…");
  const [sending, setSending] = useState(false);
  const loadingRef = useRef(false);
  const sendingRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const closed = ticketStatus === "resolved";

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await fetch(`/api/support/${ticketId}/chat`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        messages?: Message[];
        evidence?: Evidence[];
        status?: string;
        error?: string;
      };
      if (!response.ok)
        return setStatus(data.error ?? "Unable to load conversation.");
      setMessages(data.messages ?? []);
      setEvidence(data.evidence ?? []);
      setTicketStatus(data.status ?? "");
      setStatus("");
    } catch {
      setStatus("Unable to load conversation.");
    } finally {
      loadingRef.current = false;
    }
  }, [ticketId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 2000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || closed || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await fetch(`/api/support/${ticketId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as {
        message?: Message;
        error?: string;
      };
      if (!response.ok) {
        alert("Please wait 10 seconds before sending another message.");
        return setStatus(data.error ?? "Unable to send message.");
      }

      if (data.message) setMessages((current) => [...current, data.message!]);
      setBody("");

      void load();
    } catch {
      setStatus("Unable to send message. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  return (
    <section className="grid gap-3" aria-label="Ticket conversation">
      <h2 className="text-base font-semibold">Conversation</h2>
      <div
        ref={transcriptRef}
        className="h-[22rem] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1018] p-3 sm:h-[26rem]"
      >
        {!messages.length && !status ? (
          <p className="grid h-full place-items-center text-center text-sm text-[var(--muted)]">
            No messages yet.
          </p>
        ) : null}
        {messages.map((message) => {
          const mine = isAdmin
            ? message.sender === "admin"
            : message.sender === "user";
          const sender =
            message.sender === "admin"
              ? "Admin"
              : message.sender === "ai"
                ? "Ninzo AI"
                : "User";
          return (
            <div
              key={message._id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 sm:max-w-[75%] ${mine ? "rounded-br-md bg-[var(--accent)] text-black" : "rounded-bl-md bg-white/10 text-white"}`}
              >
                <p
                  className={`text-xs font-semibold ${mine ? "text-black/70" : "text-[var(--accent-2)]"}`}
                >
                  {mine ? "You" : sender}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">
                  {message.body}
                </p>
                <p
                  className={`mt-1 text-right text-[10px] ${mine ? "text-black/60" : "text-[var(--muted)]"}`}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        {status ? (
          <p className="text-center text-sm text-[var(--muted)]">{status}</p>
        ) : null}
      </div>
      {evidence.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {evidence.map((item) => (
            <a
              key={item._id}
              href={item.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border border-white/10"
            >
              <Image
                height={200}
                width={200}
                src={item.imageUrl}
                alt="Attached support screenshot"
                className="aspect-video w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      {closed ? (
        <p className="text-sm text-[var(--muted)]">
          This support request has been closed.
        </p>
      ) : (
        <form
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2"
          onSubmit={send}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            disabled={sending}
            placeholder={sending ? "Sending message…" : "Type a message…"}
            aria-label={isAdmin ? "Reply to user" : "Message support"}
          />
          <Button
            type="submit"
            className="h-10 w-10 shrink-0 rounded-xl p-0"
            disabled={sending || !body.trim()}
            aria-label="Send message"
          >
            {sending ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <SendHorizontal size={18} />
            )}
          </Button>
        </form>
      )}
    </section>
  );
}

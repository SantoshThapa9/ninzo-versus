"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

type IncomingMessage = {
  id: string;
  matchId: string;
  senderName: string;
  body: string;
  url?: string;
};
type SupportReply = { id: string; ticketId: string; body: string };

function playMessageSound() {
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(940, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.33);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Browser audio permissions are best-effort and must not interrupt polling.
  }
}

function showBrowserMessageNotification(message: IncomingMessage) {
  if (Notification.permission !== "granted" || !("serviceWorker" in navigator)) {
    return;
  }
  void navigator.serviceWorker.ready
    .then((registration) =>
      registration.showNotification(`${message.senderName} sent you a message`, {
        body: message.body,
        icon: "/nv.jpg",
        badge: "/nv.ico",
        // A distinct tag keeps every incoming message visible instead of
        // replacing the previous notification from the same Clash.
        tag: `clash-chat-${message.id}`,
        data: { url: message.url ?? `/clash/${message.matchId}` },
      }),
    )
    .catch(() => {
      // The in-app toast remains available if the worker is unavailable.
    });
}

/** Shows incoming private-chat messages while the signed-in app is open. */
export function ChatNotificationListener() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const polling = useRef(false);
  const lastPollingErrorAt = useRef(0);
  const seenMessageIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const seenSupportReplyIds = useRef(new Set<string>());
  const supportInitialized = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible" || polling.current) return;
      polling.current = true;
      try {
        const signal = AbortSignal.timeout(5_000);
        const [response, supportResponse] = await Promise.all([
          fetch("/api/notifications/chat", {
            cache: "no-store",
            signal,
          }),
          fetch("/api/notifications/support", {
            cache: "no-store",
            signal,
          }),
        ]);
        if (response.status === 401 && supportResponse.status === 401) return;
        const failedResponse = [response, supportResponse].find(
          (item) => !item.ok && item.status !== 401,
        );
        if (failedResponse) {
          throw new Error(
            `Notification polling failed with ${failedResponse.status}.`,
          );
        }
        const [data, supportData] = await Promise.all([
          response.ok
            ? (response.json() as Promise<{ messages?: IncomingMessage[] }>)
            : Promise.resolve({ messages: [] }),
          supportResponse.ok
            ? (supportResponse.json() as Promise<{ messages?: SupportReply[] }>)
            : Promise.resolve({ messages: [] }),
        ]);
        const messages = data.messages ?? [];
        if (!initialized.current) {
          messages.forEach((message) => seenMessageIds.current.add(message.id));
          initialized.current = true;
          return;
        }
        for (const message of messages.reverse()) {
          if (seenMessageIds.current.has(message.id)) continue;
          seenMessageIds.current.add(message.id);
          if (pathnameRef.current === `/clash/${message.matchId}`) continue;
          toast(`${message.senderName} sent a message`, {
            description: message.body,
            action: {
              label: "Open chat",
              onClick: () => router.push(`/clash/${message.matchId}`),
            },
          });
          showBrowserMessageNotification(message);
          playMessageSound();
        }

        const supportReplies = supportData.messages ?? [];
        if (!supportInitialized.current) {
          supportReplies.forEach((reply) =>
            seenSupportReplyIds.current.add(reply.id),
          );
          supportInitialized.current = true;
          return;
        }
        for (const reply of supportReplies.reverse()) {
          if (seenSupportReplyIds.current.has(reply.id)) continue;
          seenSupportReplyIds.current.add(reply.id);
          if (pathnameRef.current === `/support/${reply.ticketId}`) continue;
          toast("Ninzo Support replied", {
            description: reply.body,
            action: {
              label: "Open ticket",
              onClick: () => router.push(`/support/${reply.ticketId}`),
            },
          });
          showBrowserMessageNotification({
            id: `support-${reply.id}`,
            matchId: reply.ticketId,
            senderName: "Ninzo Support",
            body: reply.body,
            url: `/support/${reply.ticketId}`,
          });
          playMessageSound();
        }
      } catch (error) {
        if (Date.now() - lastPollingErrorAt.current >= 60_000) {
          console.error(
            "[notifications] Polling failed; it will retry automatically.",
            error,
          );
          lastPollingErrorAt.current = Date.now();
        }
      } finally {
        polling.current = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}

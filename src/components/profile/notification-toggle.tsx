"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

function toApplicationServerKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const value = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

export function NotificationToggle() {
  const [supported, setSupported] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const isSupported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

      setSupported(isSupported);

      if (!isSupported) {
        setReady(true);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();

        setEnabled(Boolean(subscription));
      } finally {
        setReady(true);
      }
    };

    void initialize();
  }, []);

  async function updateNotifications() {
    if (!supported || saving) return;

    setSaving(true);

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        const response = await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });

        if (!response.ok) {
          throw new Error("Could not remove subscription.");
        }

        await existing.unsubscribe();
        setEnabled(false);
        toast.success("Challenge notifications disabled.");
        return;
      }

      if (Notification.permission === "denied") {
        toast.error("Notifications are blocked in your browser settings.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error("Notification permission was not granted.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });

      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("Could not save subscription.");
      }

      setEnabled(true);
      toast.success("Challenge notifications enabled.");
    } catch {
      toast.error("Could not update notifications. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Bell size={19} className="shrink-0 text-[var(--accent)]" />

        <div>
          <p className="font-semibold">Challenge notifications</p>
          <p className="text-xs text-[var(--muted)]">
            {supported
              ? "Get an alert when someone accepts your Clash challenge."
              : "Push notifications are not supported by this browser."}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle challenge notifications"
        disabled={!supported || !ready || saving}
        onClick={() => void updateNotifications()}
        data-state={enabled ? "on" : "off"}
        className="relative h-7 w-12 shrink-0 rounded-full bg-white/15 transition-colors data-[state=on]:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </section>
  );
}

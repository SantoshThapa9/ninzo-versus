"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

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
          body: JSON.stringify({
            endpoint: existing.endpoint,
          }),
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
        setShowTutorial(true);
        toast.error(
          "Notifications are blocked in Chrome. Follow the tutorial below.",
        );
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setShowTutorial(true);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("Could not save subscription.");
      }

      setEnabled(true);
      setShowTutorial(false);

      toast.success("Challenge notifications enabled.");
    } catch {
      toast.error("Could not update notifications. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const tutorialSteps = [
    {
      title: "Open site settings",
      description:
        "Click the site settings icon next to the website address in Chrome's search bar.",
      image: "/notify-tut/step1.webp",
    },
    {
      title: "Open Permissions",
      description:
        "Click Permissions and find the Notifications permission for this website.",
      image: "/notify-tut/step2.webp",
    },
    {
      title: "Allow notifications",
      description:
        "Set Notifications to Allow, then come back here and turn on the switch.",
      image: "/notify-tut/step3.webp",
    },
  ];

  const currentStep = tutorialSteps[tutorialStep];

  function previousStep() {
    setTutorialStep((step) => Math.max(0, step - 1));
  }

  function nextStep() {
    setTutorialStep((step) => Math.min(tutorialSteps.length - 1, step + 1));
  }

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between gap-4 p-3">
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
      </div>

      {/* Tutorial is available for everyone */}
      <div className="border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowTutorial((value) => !value)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs text-[var(--muted)] transition hover:bg-white/[0.03] hover:text-white"
          aria-expanded={showTutorial}
        >
          <span>How to turn on notifications</span>

          <ChevronDown
            size={16}
            className={`transition-transform ${
              showTutorial ? "rotate-180" : ""
            }`}
          />
        </button>

        {showTutorial && (
          <div className="border-t border-white/10 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{currentStep.title}</p>

                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Step {tutorialStep + 1} of {tutorialSteps.length}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous tutorial step"
                  disabled={tutorialStep === 0}
                  onClick={previousStep}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft size={17} />
                </button>

                <button
                  type="button"
                  aria-label="Next tutorial step"
                  disabled={tutorialStep === tutorialSteps.length - 1}
                  onClick={nextStep}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="relative">
                <Image
                  src={currentStep.image}
                  alt={currentStep.description}
                  width={1200}
                  height={800}
                  className="h-auto w-full"
                />

                {tutorialStep > 0 && (
                  <button
                    type="button"
                    aria-label="Previous step"
                    onClick={previousStep}
                    className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90"
                  >
                    <ChevronLeft size={19} />
                  </button>
                )}

                {tutorialStep < tutorialSteps.length - 1 && (
                  <button
                    type="button"
                    aria-label="Next step"
                    onClick={nextStep}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/90"
                  >
                    <ChevronRight size={19} />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              {currentStep.description}
            </p>

            <div className="mt-3 flex justify-center gap-1.5">
              {tutorialSteps.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to tutorial step ${index + 1}`}
                  onClick={() => setTutorialStep(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === tutorialStep
                      ? "w-5 bg-[var(--accent)]"
                      : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>

            {!supported && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  If you don&apos;t see the notification setting, your browser
                  or device may not support notifications.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

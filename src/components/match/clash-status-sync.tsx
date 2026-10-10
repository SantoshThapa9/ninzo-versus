"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function playAcceptanceSound() {
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
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.43);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is best-effort: browser autoplay settings must never block the UI.
  }
}

/** Keeps a creator's open challenge current until an opponent accepts it. */
export function ClashStatusSync({
  isCreator,
  status,
}: {
  isCreator: boolean;
  status: string;
}) {
  const router = useRouter();
  const previousStatus = useRef(status);

  useEffect(() => {
    const wasOpen = previousStatus.current === "open";
    previousStatus.current = status;
    if (isCreator && wasOpen && status !== "open") {
      toast.success("Challenge accepted — your private match chat is ready.");
      playAcceptanceSound();
    }
  }, [isCreator, status]);

  useEffect(() => {
    if (!isCreator || status !== "open") return;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, 5_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isCreator, router, status]);

  return null;
}

"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Acceptance = {
  matchId: string;
  acceptedAt: string;
  opponentIgn: string;
};

const storageKey = "ninzo:challenge-acceptances";

function readSeenAcceptances() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

export function ChallengeAcceptanceNotifier({ userId }: { userId?: string }) {
  const router = useRouter();
  const checkForAcceptances = useCallback(async () => {
    if (!userId) return;
    const response = await fetch("/api/clash/notifications", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { acceptances?: Acceptance[] };
    const seen = readSeenAcceptances();
    let hasNewAcceptance = false;

    for (const acceptance of data.acceptances ?? []) {
      const key = `${acceptance.matchId}:${acceptance.acceptedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hasNewAcceptance = true;
      toast.success(`${acceptance.opponentIgn} accepted your challenge.`, {
        action: {
          label: "Open match",
          onClick: () => router.push(`/clash/${acceptance.matchId}`),
        },
      });
    }

    if (hasNewAcceptance) {
      localStorage.setItem(storageKey, JSON.stringify([...seen].slice(-100)));
      router.refresh();
    }
  }, [router, userId]);

  useEffect(() => {
    void checkForAcceptances();
    const interval = window.setInterval(() => void checkForAcceptances(), 10_000);
    return () => window.clearInterval(interval);
  }, [checkForAcceptances]);

  return null;
}

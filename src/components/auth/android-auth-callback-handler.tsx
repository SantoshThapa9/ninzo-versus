"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { signIn } from "next-auth/react";

const PENDING_HANDOFF_KEY = "nv-android-google-pending";
const APP_CALLBACK_SCHEME = "com.ninzoversus.app:";
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;
let callbackInProgress = false;

type PendingHandoff = {
  verifier: string;
  state: string;
  expiresAt: number;
};

function isPendingHandoff(value: unknown): value is PendingHandoff {
  if (typeof value !== "object" || value === null) return false;
  const pending = value as Partial<PendingHandoff>;
  return (
    typeof pending.verifier === "string" &&
    BASE64URL_32_BYTES.test(pending.verifier) &&
    typeof pending.state === "string" &&
    BASE64URL_32_BYTES.test(pending.state) &&
    typeof pending.expiresAt === "number" &&
    pending.expiresAt > Date.now()
  );
}

export default function AndroidAuthCallbackHandler() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let active = true;
    let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;

    const handleCallback = async (rawUrl: string) => {
      if (callbackInProgress) return;

      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return;
      }
      if (
        url.protocol !== APP_CALLBACK_SCHEME ||
        url.hostname !== "auth" ||
        url.pathname !== "/callback"
      ) {
        return;
      }

      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      let pendingValue: unknown;
      try {
        pendingValue = JSON.parse(
          localStorage.getItem(PENDING_HANDOFF_KEY) ?? "null",
        );
      } catch {
        pendingValue = null;
      }
      if (!BASE64URL_32_BYTES.test(code) || !isPendingHandoff(pendingValue)) {
        if (pendingValue === null) return;
        window.location.replace("/login?error=GoogleSignInFailed");
        return;
      }
      if (pendingValue.state !== state) return;

      callbackInProgress = true;
      localStorage.removeItem(PENDING_HANDOFF_KEY);
      try {
        await Browser.close();
      } catch {
        // The custom tab can already be closed when Android delivers the link.
      }

      try {
        const result = await signIn("android-google-handoff", {
          code,
          verifier: pendingValue.verifier,
          redirect: false,
          callbackUrl: "/",
        });
        if (!result?.ok) {
          window.location.replace("/login?error=GoogleSignInFailed");
          return;
        }
        window.location.replace("/");
      } catch {
        window.location.replace("/login?error=GoogleSignInFailed");
      }
    };

    void (async () => {
      listener = await App.addListener("appUrlOpen", ({ url }) => {
        void handleCallback(url);
      });
      if (!active) {
        await listener.remove();
        return;
      }

      const launch = await App.getLaunchUrl();
      if (active && launch?.url) await handleCallback(launch.url);
    })();

    return () => {
      active = false;
      void listener?.remove();
    };
  }, []);

  return null;
}

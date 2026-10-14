"use client";

import { useEffect, useState } from "react";

const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;
const STARTED_STATES_KEY = "nv-android-google-finish-states";
const APP_CALLBACK_SCHEME = "com.ninzoversus.app:";

export default function AndroidGoogleAuthFinish() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challenge = params.get("challenge") ?? "";
    const state = params.get("state") ?? "";
    if (
      !BASE64URL_32_BYTES.test(challenge) ||
      !BASE64URL_32_BYTES.test(state)
    ) {
      window.location.replace("/login?error=GoogleSignInFailed");
      return;
    }

    const storageKey = `${STARTED_STATES_KEY}:${state}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "started");

    void (async () => {
      try {
        const response = await fetch("/api/auth/android/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge, state }),
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Android session handoff failed.");

        const result: unknown = await response.json();
        if (
          typeof result !== "object" ||
          result === null ||
          !("callbackUrl" in result) ||
          typeof result.callbackUrl !== "string"
        ) {
          throw new Error("Invalid Android session handoff response.");
        }

        const callbackUrl = new URL(result.callbackUrl);
        if (
          callbackUrl.protocol !== APP_CALLBACK_SCHEME ||
          callbackUrl.hostname !== "auth" ||
          callbackUrl.pathname !== "/callback" ||
          callbackUrl.searchParams.get("state") !== state ||
          !BASE64URL_32_BYTES.test(
            callbackUrl.searchParams.get("code") ?? "",
          )
        ) {
          throw new Error("Invalid Android app callback.");
        }

        window.location.replace(callbackUrl.toString());
      } catch {
        sessionStorage.removeItem(storageKey);
        setError(true);
      }
    })();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">
        {error ? "Could not return to Ninzo Versus" : "Returning to the app…"}
      </h1>
      {error ? (
        <p className="text-sm text-[var(--muted)]">
          Close this browser tab, return to the app, and try signing in again.
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Your sign-in is complete. This page will close automatically.
        </p>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export default function AndroidGoogleAuthStart() {
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

    const startKey = `nv-android-google-start:${state}`;
    if (sessionStorage.getItem(startKey)) return;
    sessionStorage.setItem(startKey, "started");

    const callbackUrl = new URL(
      "/auth/android/finish",
      window.location.origin,
    );
    callbackUrl.searchParams.set("challenge", challenge);
    callbackUrl.searchParams.set("state", state);

    void signIn("google", { callbackUrl: callbackUrl.toString() }).catch(() => {
      sessionStorage.removeItem(startKey);
      setError(true);
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">
        {error ? "Google sign-in could not start" : "Connecting to Google…"}
      </h1>
      {error ? (
        <p className="text-sm text-[var(--muted)]">
          Return to Ninzo Versus and try again.
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Complete sign-in in your browser. You will return to the app
          automatically.
        </p>
      )}
    </main>
  );
}

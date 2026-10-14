"use client";

import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";

export default function GoogleSignInButton({
  label = "Continue with Google",
  callbackUrl = "/",
  initialError = false,
}: {
  label?: string;
  callbackUrl?: string;
  initialError?: boolean;
}) {
  const [error, setError] = useState(initialError);
  const [starting, setStarting] = useState(false);

  const startSignIn = async () => {
    setError(false);
    if (Capacitor.getPlatform() !== "android") {
      await signIn("google", { callbackUrl });
      return;
    }

    setStarting(true);
    try {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const verifier = toBase64Url(randomBytes);
      const stateBytes = new Uint8Array(32);
      crypto.getRandomValues(stateBytes);
      const state = toBase64Url(stateBytes);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier),
      );
      const challenge = toBase64Url(new Uint8Array(digest));

      localStorage.setItem(
        "nv-android-google-pending",
        JSON.stringify({
          verifier,
          state,
          expiresAt: Date.now() + 10 * 60 * 1000,
        }),
      );

      const startUrl = new URL("/auth/android/start", window.location.origin);
      startUrl.searchParams.set("challenge", challenge);
      startUrl.searchParams.set("state", state);
      await Browser.open({ url: startUrl.toString() });
    } catch {
      localStorage.removeItem("nv-android-google-pending");
      setError(true);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void startSignIn()}
        disabled={starting}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-100 disabled:cursor-wait disabled:opacity-70"
      >
        {starting ? "Opening browser…" : label}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          Google sign-in could not be completed. Please try again.
        </p>
      ) : null}
    </>
  );
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

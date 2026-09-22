"use client";

import { signIn } from "next-auth/react";

export default function GoogleSignInButton({
  label = "Continue with Google",
  callbackUrl = "/lobby",
}: {
  label?: string;
  callbackUrl?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-100"
    >
      {label}
    </button>
  );
}

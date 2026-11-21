"use client";

import { useState } from "react";
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

  const startSignIn = async () => {
    setError(false);
    await signIn("google", { callbackUrl });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void startSignIn()}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-gray-100"
      >
        {label}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-400" role="alert">
          Google sign-in could not be completed. Please try again.
        </p>
      ) : null}
    </>
  );
}

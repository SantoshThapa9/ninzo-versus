"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed", error);
  }, [error]);

  return (
    <section className="grid gap-3 p-6" role="alert">
      <h1 className="text-xl font-bold">We couldn&apos;t load this page</h1>
      <p className="text-sm text-[var(--muted)]">
        Check your connection and try again. Your data has not been changed.
      </p>
      <button
        type="button"
        onClick={retry}
        className="w-fit rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black"
      >
        Try again
      </button>
    </section>
  );
}

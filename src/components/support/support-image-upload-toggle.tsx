"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";

export function SupportImageUploadToggle({
  ticketId,
  initiallyEnabled,
}: {
  ticketId: string;
  initiallyEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/support/${ticketId}/image-upload-permission`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        },
      );
      if (!response.ok) throw new Error("Unable to update image uploads.");
      setEnabled(next);
    } catch {
      setError("Could not update image uploads. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ImagePlus size={18} className="shrink-0 text-[var(--accent)]" />
          <div>
            <p className="font-semibold">Customer screenshot uploads</p>
            <p className="text-xs text-[var(--muted)]">
              {enabled
                ? "The customer can attach images to this support request."
                : "The customer cannot attach images to this support request."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Allow customer screenshot uploads"
          disabled={saving}
          onClick={() => void toggle()}
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
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}

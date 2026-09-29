"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";

export function SupportUpload({ ticketId }: { ticketId: string }) {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setError("");
    setIsUploading(true);
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "support");
    body.set("ticketId", ticketId);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Could not upload the screenshot.");
      }
      window.location.reload();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the screenshot.");
      setIsUploading(false);
    }
  }
  return (
    <div className="mt-3">
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 text-sm font-semibold transition hover:bg-white/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        <ImagePlus className="size-4" aria-hidden="true" />
        {isUploading ? "Uploading…" : "Attach screenshot"}
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          disabled={isUploading}
          onChange={onChange}
        />
      </label>
      {selectedFileName ? <p className="mt-1 text-xs text-[var(--muted)]">Selected: {selectedFileName}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">
        Add an optional screenshot. Video uploads are not supported.
      </p>
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

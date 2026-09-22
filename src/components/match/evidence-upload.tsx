"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EvidenceUpload({ matchId }: { matchId: string }) {
  const [status, setStatus] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "evidence");
    body.set("matchId", matchId);
    body.set("kind", "post_match_result");
    setStatus("Uploading...");
    const res = await fetch("/api/upload", { method: "POST", body });
    const json = (await res.json()) as { error?: string };
    setStatus(json.error ?? "Uploaded. AI will analyze the result.");
  }

  return (
    <div className="grid gap-2">
      <input type="file" accept="image/*" onChange={onChange} />
      {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
      <Button type="button" variant="secondary" size="sm" asChild>
        <label>
          Choose file
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={onChange}
          />
        </label>
      </Button>
    </div>
  );
}

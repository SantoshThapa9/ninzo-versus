"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EvidenceUpload({ matchId }: { matchId: string }) {
  const [kind, setKind] = useState("pre_match_start");
  const [status, setStatus] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "evidence");
    body.set("matchId", matchId);
    body.set("kind", kind);
    setStatus("Uploading...");
    const res = await fetch("/api/upload", { method: "POST", body });
    const json = (await res.json()) as { error?: string };
    setStatus(json.error ?? "Uploaded. Admin will confirm the winner.");
  }

  return (
    <div className="grid gap-2">
      <select
        className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="pre_match_start">Pre-match START screenshot</option>
        <option value="post_match_result">Post-match result screenshot</option>
        <option value="video">Video (recommended)</option>
      </select>
      <input type="file" accept="image/*,video/*" onChange={onChange} />
      {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
      <Button type="button" variant="secondary" size="sm" asChild>
        <label>
          Choose file
          <input className="hidden" type="file" accept="image/*,video/*" onChange={onChange} />
        </label>
      </Button>
    </div>
  );
}

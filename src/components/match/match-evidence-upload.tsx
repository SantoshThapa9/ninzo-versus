"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MatchEvidenceUpload({ matchId, hasPostMatch }: { matchId: string; hasPostMatch: boolean }) {
  const [resultFile, setResultFile] = useState<File>();
  const [status, setStatus] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("Uploading screenshots…");
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "evidence");
    body.set("matchId", matchId);
    body.set("kind", "post_match_result");
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setResultFile(undefined);
      return setStatus(
        data.error ??
          "We couldn't read the screenshot. Please upload a clear final-result image again.",
      );
    }
    setStatus("Submitted. Waiting for the other player or AI review…");
    window.location.reload();
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--muted)]">Submit one final match-result screenshot. Images only.</p>
      {hasPostMatch ? <p className="text-sm text-[var(--accent-2)]">Result screenshot submitted.</p> : <><input type="file" accept="image/*" onChange={(event) => setResultFile(event.target.files?.[0])} /><Button type="button" size="sm" disabled={!resultFile} onClick={() => void upload(resultFile)}>Upload result screenshot</Button></>}
      {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
    </div>
  );
}

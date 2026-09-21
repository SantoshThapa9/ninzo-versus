"use client";

export function SupportUpload({ ticketId }: { ticketId: string }) {
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "support");
    body.set("ticketId", ticketId);
    await fetch("/api/upload", { method: "POST", body });
    window.location.reload();
  }
  return (
    <div className="mt-3">
      <input type="file" accept="image/*,video/*" onChange={onChange} />
      <p className="mt-1 text-xs text-[var(--muted)]">Screenshots and video stay private.</p>
    </div>
  );
}

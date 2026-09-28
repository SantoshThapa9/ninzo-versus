export default function Loading() {
  return (
    <div className="grid gap-4 p-6" role="status" aria-live="polite">
      <span className="text-sm text-[var(--muted)]">Loading Ninzo Versus…</span>
      <div className="h-24 animate-pulse rounded-[var(--radius)] bg-white/5" />
      <div className="h-24 animate-pulse rounded-[var(--radius)] bg-white/5" />
      <span className="sr-only">Page content is loading</span>
    </div>
  );
}

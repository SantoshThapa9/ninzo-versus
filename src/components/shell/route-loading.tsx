export function RouteLoading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      className="grid gap-4 pb-2"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${title}`}
    >
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </header>
      <div className="h-24 animate-pulse rounded-[var(--radius)] bg-white/5" />
      <div className="h-24 animate-pulse rounded-[var(--radius)] bg-white/5" />
      <span className="sr-only">Loading {title}</span>
    </section>
  );
}

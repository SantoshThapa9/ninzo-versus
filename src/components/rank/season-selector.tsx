"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type SeasonOption = { slug: string; name: string };

export function SeasonSelector({
  seasons,
  selectedSlug,
  tab,
}: {
  seasons: SeasonOption[];
  selectedSlug: string;
  tab: "rankings" | "event-results";
}) {
  const router = useRouter();

  return (
    <div className="relative w-fit">
      <label htmlFor="rank-season" className="sr-only">
        Select ranking season
      </label>
      <select
        id="rank-season"
        value={selectedSlug}
        onChange={(event) => {
          const params = new URLSearchParams({ season: event.target.value });
          if (tab === "event-results") params.set("tab", tab);
          router.push(`/rank?${params.toString()}`);
        }}
        className="appearance-none rounded-lg border border-white/10 bg-black/30 py-2 pl-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-[var(--accent)]"
      >
        {seasons.map((season) => (
          <option key={season.slug} value={season.slug} className="bg-black">
            {season.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  );
}

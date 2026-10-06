"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, ChevronDown, Clock3, Medal } from "lucide-react";
import { RANKS } from "@/lib/rank";

type SeasonOption = { slug: string; name: string; daysInMonth: number };
type OpenDropdown = "season" | "rank" | null;

export function RankFilters({
  seasons,
  selectedSlug,
  tab,
}: {
  seasons: SeasonOption[];
  selectedSlug: string;
  tab: "rankings" | "event-results";
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const selectedSeason = seasons.find(({ slug }) => slug === selectedSlug);
  const seasonLabel = (season: SeasonOption) =>
    `${season.name} (1–${season.daysInMonth})`;

  useEffect(() => {
    if (!openDropdown) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDropdown(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openDropdown]);

  function toggleDropdown(dropdown: Exclude<OpenDropdown, null>) {
    setOpenDropdown((current) => (current === dropdown ? null : dropdown));
  }

  function selectSeason(slug: string) {
    const params = new URLSearchParams({ season: slug });
    if (tab === "event-results") params.set("tab", tab);
    setOpenDropdown(null);
    router.push(`/rank?${params.toString()}`);
  }

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3"
      aria-label="Rank filters"
    >
      <div className="relative min-w-0">
        <button
          type="button"
          aria-expanded={openDropdown === "season"}
          aria-controls="rank-season-options"
          onClick={() => toggleDropdown("season")}
          className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition ${
            openDropdown === "season"
              ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 shadow-[0_0_24px_rgba(245,190,60,0.08)]"
              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Clock3
              aria-hidden
              size={16}
              className="shrink-0 text-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Season
              </span>
              <span className="block truncate text-xs font-extrabold sm:text-sm">
                {selectedSeason ? seasonLabel(selectedSeason) : "Select season"}
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden
            size={16}
            className={`shrink-0 text-[var(--muted)] transition-transform ${
              openDropdown === "season" ? "rotate-180" : ""
            }`}
          />
        </button>

        {openDropdown === "season" && (
          <div
            id="rank-season-options"
            className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-max min-w-full max-w-[calc(200%+0.75rem)] overflow-hidden rounded-xl border border-white/10 bg-[#11151d] p-1.5 shadow-2xl shadow-black/50"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Choose a season
            </p>
            <div className="grid gap-1">
              {seasons.map((season) => {
                const selected = season.slug === selectedSlug;
                return (
                  <button
                    key={season.slug}
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => selectSeason(season.slug)}
                    className={`flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition ${
                      selected
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "text-white hover:bg-white/[0.07]"
                    }`}
                  >
                    <span>{seasonLabel(season)}</span>
                    {selected && <Check aria-hidden size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {tab === "rankings" ? (
        <div className="relative min-w-0">
          <button
            type="button"
            aria-expanded={openDropdown === "rank"}
            aria-controls="rank-level-options"
            onClick={() => toggleDropdown("rank")}
            className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition ${
              openDropdown === "rank"
                ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 shadow-[0_0_24px_rgba(245,190,60,0.08)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Medal
                aria-hidden
                size={16}
                className="shrink-0 text-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Learn about
                </span>
                <span className="block truncate text-xs font-extrabold sm:text-sm">
                  Rank levels
                </span>
              </span>
            </span>
            <ChevronDown
              aria-hidden
              size={16}
              className={`shrink-0 text-[var(--muted)] transition-transform ${
                openDropdown === "rank" ? "rotate-180" : ""
              }`}
            />
          </button>

          {openDropdown === "rank" && (
            <div
              id="rank-level-options"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[calc(200%+0.75rem)] max-w-[calc(200%+0.75rem)] rounded-xl border border-white/10 bg-[#11151d] p-3 shadow-2xl shadow-black/50"
            >
              <div className="mb-2.5">
                <p className="text-xs font-extrabold">Rank levels</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  Wins add 10 points; losses subtract 5 points.
                </p>
              </div>
              <div className="grid gap-1.5">
                {RANKS.map((rank, index) => (
                  <div
                    key={rank.name}
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5"
                  >
                    <Image
                      src={rank.image}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 shrink-0 object-contain"
                    />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <p className={`text-xs font-bold ${rank.className}`}>
                        {rank.name}
                      </p>
                      <p className="shrink-0 text-[10px] text-[var(--muted)]">
                        {index === 0
                          ? `${rank.minimumScore}+ pts`
                          : `${rank.minimumScore}–${
                              index === RANKS.length - 1
                                ? "∞"
                                : RANKS[index + 1].minimumScore - 1
                            } pts`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div aria-hidden className="min-w-0" />
      )}
    </div>
  );
}

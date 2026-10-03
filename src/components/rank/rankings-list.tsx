"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { getRank, RANK_PAGE_SIZE, type PlayerRank } from "@/lib/rank";
import { Crown, Medal } from "lucide-react";

type RankingsListProps = {
  initialPlayers: PlayerRank[];
  initialHasMore: boolean;
  seasonSlug: string;
};

const BOTTOM_THRESHOLD_PX = 80;

function isPageScrolledToEnd() {
  const doc = document.documentElement;
  // Page must be taller than the viewport — otherwise we're not "scrolled to end".
  if (doc.scrollHeight <= window.innerHeight + 1) return false;
  return (
    window.scrollY + window.innerHeight >=
    doc.scrollHeight - BOTTOM_THRESHOLD_PX
  );
}

export function RankingsList({
  initialPlayers,
  initialHasMore,
  seasonSlug,
}: RankingsListProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(initialPlayers.length);
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rank?${new URLSearchParams({
          season: seasonSlug,
          offset: String(offsetRef.current),
          limit: String(RANK_PAGE_SIZE),
        })}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) throw new Error("Failed to load more rankings");
      const data = (await res.json()) as {
        players: PlayerRank[];
        hasMore: boolean;
      };
      setPlayers((prev) => {
        const seen = new Set(prev.map((p) => p.userId));
        const added = data.players.filter((p) => !seen.has(p.userId));
        offsetRef.current = prev.length + added.length;
        return [...prev, ...added];
      });
      hasMoreRef.current = data.hasMore;
      setHasMore(data.hasMore);
    } catch {
      setError("Couldn't load more rankings. Scroll to retry.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [seasonSlug]);

  useEffect(() => {
    if (!hasMore) return;

    const onScroll = () => {
      if (isPageScrolledToEnd()) void loadMore();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loadMore]);

  if (players.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          No ranked players yet. Complete a 1v1 challenge to appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {players.map((player, index) => {
        const rank = getRank(player.winRate);
        return (
          <Card key={player.userId} className="flex items-center gap-3 py-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-extrabold text-[var(--muted)]">
              {index < 3 ? (
                <Crown
                  size={18}
                  className={
                    index === 0
                      ? "text-yellow-300"
                      : index === 1
                        ? "text-slate-300"
                        : "text-amber-600"
                  }
                />
              ) : (
                index + 1
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{player.ign}</p>
              <p className="truncate text-xs text-[var(--muted)]">
                {player.displayName}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {player.wins} wins · {player.matches} matches
              </p>
            </div>
            <div className="text-right">
              <p
                className={`flex items-center justify-end gap-1 text-sm font-extrabold ${rank.className}`}
              >
                <Medal size={15} />
                {player.rank}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {player.winRate}% win rate
              </p>
            </div>
          </Card>
        );
      })}

      {loading ? (
        <p className="py-3 text-center text-xs text-[var(--muted)]">
          Loading more…
        </p>
      ) : error ? (
        <p className="py-3 text-center text-xs text-[var(--muted)]">{error}</p>
      ) : null}

      {hasMore ? (
        <div
          className="flex min-h-[10vh] items-start justify-center pt-6"
          aria-hidden
        >
          {!loading && !error ? (
            <p className="text-xs text-[var(--muted)]">Scroll for more</p>
          ) : null}
        </div>
      ) : players.length > RANK_PAGE_SIZE ? (
        <p className="py-2 text-center text-xs text-[var(--muted)]">
          End of rankings
        </p>
      ) : null}
    </div>
  );
}

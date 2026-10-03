import { Play, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type WatchAdRewardProps = {
  reward?: number;
  disabled?: boolean;
  unavailableText?: string;
  title?: string;
  description?: string;
};

export function DailyAd({
  reward = 0.1,
  disabled = true,
  unavailableText = "Currently Not Available",
  title = "Watch & Earn NV",
  description = "Watch a short ad and earn free NV Tokens",
}: WatchAdRewardProps) {
  return (
    <section
      className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 p-3 sm:p-4"
      aria-labelledby="watch-ad-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Header */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <Play size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 id="watch-ad-heading" className="text-sm font-bold">
                {title}
              </h2>

              <Sparkles size={13} className="shrink-0 text-[var(--accent)]" />

              <span className="text-xs font-extrabold text-[var(--accent)]">
                +{reward.toFixed(2)} NV
              </span>
            </div>

            <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
              {description}
            </p>
          </div>
        </div>

        {/* Action */}
        <Button
          size="sm"
          disabled={disabled}
          className="w-full shrink-0 cursor-not-allowed opacity-60 sm:w-auto"
        >
          {unavailableText}
        </Button>
      </div>

      {/* Reward Info */}
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <PlayCircle size={14} className="shrink-0 text-[var(--accent)]" />

          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--accent)]">
            Reward
          </span>

          <span className="text-sm font-black">{reward.toFixed(2)} NV</span>
        </div>

        <span className="text-[10px] font-semibold text-[var(--muted)]">
          Ad reward
        </span>
      </div>
    </section>
  );
}

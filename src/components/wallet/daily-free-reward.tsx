"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, ChevronDown, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { DAILY_FREE_REWARD_SCHEDULE } from "@/config/defaults";
import { claimDailyFreeRewardAction } from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RewardState = {
  error?: string;
  ok?: boolean;
  message?: string;
  rewardDay?: number;
  amount?: number;
} | null;

export function DailyFreeReward({
  signedIn,
  claimed,
  rewardDay,
  streak,
  reset,
  cycleComplete,
  nextAvailableLabel,
}: {
  signedIn: boolean;
  claimed: boolean;
  rewardDay: number;
  streak: number;
  reset: boolean;
  cycleComplete: boolean;
  nextAvailableLabel: string;
}) {
  const [state, formAction, pending] = useActionState<RewardState, FormData>(
    claimDailyFreeRewardAction,
    null,
  );

  const claimedToday = claimed || Boolean(state?.ok);
  const activeDay = state?.rewardDay ?? rewardDay;
  const progress = claimedToday ? activeDay : streak;

  const totalClaimedAmount = DAILY_FREE_REWARD_SCHEDULE.slice(
    0,
    progress,
  ).reduce((total, amount) => total + amount, 0);

  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <section
      className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 p-3 sm:p-4"
      aria-labelledby="daily-reward-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            {claimedToday ? <Check size={18} /> : <Gift size={18} />}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 id="daily-reward-heading" className="text-sm font-bold">
                Daily Free NV
              </h2>

              <Sparkles size={13} className="text-[var(--accent)]" />

              <span className="text-xs font-extrabold text-[var(--accent)]">
                {progress}/7 streak
              </span>
            </div>

            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {claimedToday
                ? `Claimed today · Next: ${nextAvailableLabel}`
                : `Day ${activeDay} rewards ${DAILY_FREE_REWARD_SCHEDULE[
                    activeDay - 1
                  ].toFixed(2)} NV`}
            </p>
          </div>
        </div>

        {claimedToday ? (
          <span className="shrink-0 text-xs font-semibold text-[var(--accent-2)]">
            Claimed today
          </span>
        ) : signedIn ? (
          <form action={formAction}>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Claiming..." : "Claim"}
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <Link href="/login?callbackUrl=/#home">Claim</Link>
          </Button>
        )}
      </div>

      {/* Total / Calendar toggle */}
      <button
        type="button"
        onClick={() => setShowCalendar((prev) => !prev)}
        aria-expanded={showCalendar}
        aria-controls="daily-reward-calendar"
        className={cn(
          "mt-3 flex w-full items-center justify-between rounded-lg border px-3 py-2",
          "border-[var(--accent)]/35 bg-[var(--accent)]/10",
          "text-[var(--accent)] transition-all",
          "hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/15",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wide">
            Total Claimed
          </span>

          <span className="text-sm font-black">
            {totalClaimedAmount.toFixed(2)} NV
          </span>
        </div>

        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-300",
            showCalendar && "rotate-180",
          )}
        />
      </button>

      {/* Calendar dropdown */}
      <div
        id="daily-reward-calendar"
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          showCalendar
            ? "mt-3 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2"
            aria-label="Seven-day reward calendar"
          >
            {DAILY_FREE_REWARD_SCHEDULE.map((amount, index) => {
              const day = index + 1;
              const isClaimed = day <= progress;
              const isCurrent = !claimedToday && day === activeDay;

              return (
                <div
                  key={day}
                  className={cn(
                    "min-w-0 rounded-lg border px-2 py-2.5 text-center transition-colors",
                    isClaimed &&
                      "border-[var(--accent-2)]/35 bg-[var(--accent-2)]/10 text-[var(--accent-2)]",
                    isCurrent &&
                      "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-white",
                    !isClaimed &&
                      !isCurrent &&
                      "border-white/8 bg-black/15 text-[var(--muted)]",
                  )}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wide">
                    Day {day}
                  </p>

                  <p className="mt-0.5 text-[11px] font-extrabold">
                    {amount.toFixed(2)}
                  </p>

                  <p className="mt-0.5 text-[9px]">
                    {isClaimed ? (
                      "Claimed"
                    ) : isCurrent ? (
                      "Current"
                    ) : (
                      <LockKeyhole
                        className="mx-auto size-3"
                        aria-label="Locked"
                      />
                    )}
                  </p>
                </div>
              );
            })}
            <div
              className={cn(
                "min-w-0 rounded-lg border px-2 py-2.5 text-center transition-colors",
                "border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--accent)]",
              )}
            >
              <p className="text-[9px] font-bold uppercase tracking-wide">
                Streak
              </p>

              <p className="mt-0.5 text-[11px] font-extrabold">
                Day {progress}
              </p>
              <p className="mt-0.5 text-[11px]">
                {totalClaimedAmount.toFixed(2)} / 5 NV claimed
              </p>
            </div>
          </div>
        </div>
      </div>

      {reset && !claimedToday ? (
        <p className="mt-3 text-xs text-[var(--accent)]">
          You missed a UTC calendar day, so today restarts at Day 1.
        </p>
      ) : null}

      {cycleComplete && !claimedToday ? (
        <p className="mt-3 text-xs text-[var(--accent-2)]">
          Day 7 complete — claim today to start a new cycle at Day 1.
        </p>
      ) : null}

      {state?.error ? (
        <p className="mt-3 text-xs text-[var(--danger)]">{state.error}</p>
      ) : null}

      {state?.ok ? (
        <p className="mt-3 text-xs text-[var(--accent-2)]">{state.message}</p>
      ) : null}
    </section>
  );
}

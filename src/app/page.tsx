import Link from "next/link";
import { auth } from "@/auth";
import { listOpenMatches } from "@/services/match.service";
import { listPublicEvents } from "@/services/event.service";
import { getPlatformSettings } from "@/services/settings.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { connectDb } from "@/lib/db/mongoose";
import { userRepository } from "@/repositories/user.repository";
import {
  CalendarDays,
  ChevronRight,
  Coins,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { DailyFreeReward } from "@/components/wallet/daily-free-reward";
import { getDailyFreeRewardStatus } from "@/services/wallet.service";

export default async function HomePage() {
  const session = await auth();
  await connectDb();
  const [matches, events, settings, user, dailyReward] = await Promise.all([
    listOpenMatches(),
    listPublicEvents(),
    getPlatformSettings(),
    session?.user?.id ? userRepository.findById(session.user.id) : null,
    session?.user?.id ? getDailyFreeRewardStatus(session.user.id) : null,
  ]);
  const nextRewardDay = new Date();
  nextRewardDay.setUTCDate(nextRewardDay.getUTCDate() + 1);
  const nextRewardLabel = nextRewardDay.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="grid gap-6 pb-2">
      <Card className="relative overflow-hidden border-[var(--accent)]/25 bg-gradient-to-br from-[var(--card)] to-[#101820]">
        <div className="absolute -right-7 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
            <Coins size={21} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-2)]">
              NV Token balance
            </p>
            <p className="mt-0.5 text-3xl font-extrabold leading-none">
              {user?.availableCoins ?? 0}{" "}
              <span className="text-base text-white/65">NV</span>
            </p>

            <p className="mt-2 text-xs text-[var(--muted)]">
              {user?.lockedCoins ?? 0} NV reserved for registrations
            </p>
          </div>
        </div>
      </Card>
      <DailyFreeReward
        signedIn={Boolean(session?.user?.id)}
        claimed={dailyReward?.claimed ?? false}
        rewardDay={dailyReward?.rewardDay ?? 1}
        streak={dailyReward?.streak ?? 0}
        reset={dailyReward?.reset ?? false}
        cycleComplete={dailyReward?.cycleComplete ?? false}
        nextAvailableLabel={nextRewardLabel}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent-2)]">
            <Swords size={17} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">
              Clash arena
            </p>
          </div>
          <h1 className="mt-1 text-xl font-extrabold">Create Challenges</h1>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link
            href={
              session?.user?.id ? "/clash/new" : "/login?callbackUrl=/clash/new"
            }
            data-tour="post-challenge"
          >
            POST CHALLENGE
          </Link>
        </Button>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No open challenges yet.</p>
      ) : (
        matches.map((match) => (
          <Link
            key={String(match._id)}
            href={`/clash/${String(match._id)}`}
            className="group block"
          >
            <Card className="relative overflow-hidden rounded-2xl border-white/15 p-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--accent)]/70 group-hover:shadow-[0_18px_44px_rgba(255,106,0,0.18)]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('/cs.png')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070a10]/95 via-[#070a10]/80 to-[#070a10]/55" />

              <div className="relative p-3 text-white sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                      Challenge by
                    </p>
                    <h3 className="mt-0.5 text-base font-extrabold">
                      {match.creatorIgn ?? "Unknown"}
                    </h3>
                  </div>

                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-300/30 bg-yellow-400/15 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
                    <Coins size={12} />
                    {match.stakeMin === match.stakeMax
                      ? `${match.stakeMin} NV`
                      : `${match.stakeMin}-${match.stakeMax} NV`}
                  </div>
                </div>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/20" />

                  <div className="rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-1 text-xl font-black tracking-tight text-white">
                    {match.format}V{match.format}
                  </div>

                  <div className="h-px flex-1 bg-white/20" />
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex gap-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1">
                      <p className="text-[9px] text-white/55">Headshot</p>
                      <p className="font-bold">{match.headshot ?? "No"}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1">
                      <p className="text-[9px] text-white/55">Skill</p>
                      <p className="font-bold">
                        {match.characterSkill ?? "No"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-2)]">
                    View
                    <ChevronRight
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
      <div className="pt-1" data-tour="daily-events">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={17} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">
            Tournament hub
          </p>
        </div>
        <h2 className="mt-1 text-xl font-extrabold">Tonight&apos;s events</h2>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
      ) : (
        events.map((event) => (
          <EventCard key={String(event._id)} event={event} />
        ))
      )}
      <p className="text-xs text-[var(--muted)]">{settings.clashWarning}</p>
    </div>
  );
}

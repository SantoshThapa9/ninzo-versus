import { cache, Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { listOpenMatches } from "@/services/match.service";
import { listPublicEvents } from "@/services/event.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, Coins, Swords, Trophy } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";

const getHomeSession = cache(async () => auth());

function HomeSectionFallback({ height = "h-24" }: { height?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`${height} animate-pulse rounded-[var(--radius)] bg-white/5`}
    />
  );
}

function HomeAccountSummary() {
  return (
    <div className="sr-only">
      <h2>Ninzo Versus</h2>
      <p>
        Ninzo Versus is a competitive player platform for tournaments,
        challenges, seasonal global rankings, events, achievements, and player
        showcases.
      </p>
      <p>
        Discover competitive events, participate in challenges, follow global
        rankings, build your player profile, and showcase your achievements.
      </p>
    </div>
  );
}

async function ChallengeHeader() {
  const session = await getHomeSession();
  return (
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
  );
}

async function OpenChallenges() {
  const matches = await listOpenMatches();
  if (matches.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No open challenges yet.</p>
    );
  }

  return matches.map((match) => (
    <Link key={match._id} href={`/clash/${match._id}`} className="group block">
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
                {match.creatorIgn}
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
                <p className="text-[9px] text-white/55">Rounds</p>
                <p className="font-bold">{match.rounds}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1">
                <p className="text-[9px] text-white/55">Headshot</p>
                <p className="font-bold">{match.headshot}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1">
                <p className="text-[9px] text-white/55">Skill</p>
                <p className="font-bold">{match.characterSkill}</p>
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
  ));
}

async function PublicEvents() {
  const [events] = await Promise.all([listPublicEvents()]);
  return (
    <>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
      ) : (
        events.map((event) => <EventCard key={event._id} event={event} />)
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <div className="grid gap-6 pb-2">
      <Suspense fallback={<HomeSectionFallback />}>
        <HomeAccountSummary />
      </Suspense>
      <div className="pt-1" data-tour="daily-events">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={17} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">
            Tournament hub
          </p>
        </div>
        <h2 className="mt-1 text-xl font-extrabold">Tonight&apos;s events</h2>
      </div>
      <Suspense fallback={<HomeSectionFallback height="h-40" />}>
        <PublicEvents />
      </Suspense>
      <Suspense fallback={<HomeSectionFallback height="h-16" />}>
        <ChallengeHeader />
      </Suspense>
      <Suspense fallback={<HomeSectionFallback height="h-40" />}>
        <OpenChallenges />
      </Suspense>
    </div>
  );
}

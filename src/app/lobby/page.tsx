import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

export default async function LobbyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const [matches, events, settings, user] = await Promise.all([
    listOpenMatches(),
    listPublicEvents(),
    getPlatformSettings(),
    userRepository.findById(session.user.id),
  ]);

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
              {user?.availableCoins ?? 0} <span className="text-base text-white/65">NV</span>
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {user?.lockedCoins ?? 0} NV reserved for registrations
            </p>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent-2)]">
            <Swords size={17} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Clash arena</p>
          </div>
          <h1 className="mt-1 text-xl font-extrabold">Open challenges</h1>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/clash/new">Create challenge</Link>
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
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

              <div className="relative p-4 text-white sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Challenge by</p>
                    <h3 className="mt-1 text-lg font-extrabold">{match.creatorIgn ?? "Unknown"}</h3>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-300/30 bg-yellow-400/15 px-3 py-1.5 text-xs font-bold text-yellow-200">
                    <Coins size={13} />
                    {match.stakeMin === match.stakeMax
                      ? `${match.stakeMin} NV`
                      : `${match.stakeMin}-${match.stakeMax} NV`}
                  </div>
                </div>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/20" />
                  <div className="rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-4 py-2 text-2xl font-black tracking-tight text-white">
                    {match.format}V{match.format}
                  </div>
                  <div className="h-px flex-1 bg-white/20" />
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex gap-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
                      <p className="text-[10px] text-white/55">Headshot</p>
                      <p className="font-bold">{match.headshot ?? "No"}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
                      <p className="text-[10px] text-white/55">Skill</p>
                      <p className="font-bold">{match.characterSkill ?? "No"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-2)]">
                    View <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
      <div className="pt-1">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={17} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">Tournament hub</p>
        </div>
        <h2 className="mt-1 text-xl font-extrabold">Tonight&apos;s events</h2>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No published events. Admin decides daily.
        </p>
      ) : (
        events.map((event) => (
          <Link key={String(event._id)} href={`/events/${String(event._id)}`} className="group block">
            <Card className="relative overflow-hidden border-white/15 p-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--accent-2)]/65 group-hover:shadow-[0_18px_44px_rgba(0,224,198,0.12)]">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/br.png')" }} />
              <div className="absolute inset-0 bg-gradient-to-r from-[#080d14]/95 via-[#080d14]/82 to-[#080d14]/45" />
              <div className="relative p-4 text-white sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-2)]">Battle royale event</p>
                    <h3 className="mt-1 truncate text-lg font-extrabold">{event.name}</h3>
                  </div>
                  <Badge className="shrink-0 border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15 text-[var(--accent-2)]">{event.status}</Badge>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                    <CalendarDays size={15} className="text-[var(--accent)]" />
                    <span>{new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                    <UsersRound size={15} className="text-[var(--accent)]" />
                    <span>{event.reservedSlots}/{event.maxSlots} slots</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <p className="font-semibold text-white/80"><span className="text-white/55">Entry </span>{event.entryFeeCoins} NV <span className="px-1 text-white/35">•</span> {event.format}</p>
                  <div className="flex items-center gap-1 font-bold text-[var(--accent-2)]">View event <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
      <p className="text-xs text-[var(--muted)]">{settings.clashWarning}</p>
    </div>
  );
}

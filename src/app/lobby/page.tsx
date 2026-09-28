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
    <div className="grid gap-5">
      <Card>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">NV Token balance</p>
        <p className="mt-1 text-3xl font-extrabold">{user?.availableCoins ?? 0} NV Tokens</p>
        <p className="text-sm text-[var(--muted)]">Reserved for match registration: {user?.lockedCoins ?? 0} NV Tokens</p>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Open competitive challenges</h1>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/clash/new">Create challenge</Link>
        </Button>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No open challenges yet.</p>
      ) : (
        matches.map((match) => (
          <Link key={String(match._id)} href={`/clash/${String(match._id)}`}>
            <Card>
              <div className="flex items-center justify-between gap-2">
                <Badge>{match.format}v{match.format}</Badge>
                <span className="text-sm font-semibold">{match.stakeMin === match.stakeMax ? `${match.stakeMin} NV Tokens` : `${match.stakeMin}–${match.stakeMax} NV Tokens`}</span>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-[var(--muted)]">
                <p>Posted by: {match.creatorIgn ?? "Unknown"}</p>
                <p>Format: {match.format}v{match.format}</p>
                <p>Headshot: {match.headshot ?? "No"}</p>
                <p>Character Skill: {match.characterSkill ?? "No"}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{match.rules}</p>
            </Card>
          </Link>
        ))
      )}
      <h2 className="text-xl font-bold">Tonight&apos;s events</h2>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No published events. Admin decides daily.</p>
      ) : (
        events.map((event) => (
          <Link key={String(event._id)} href={`/events/${String(event._id)}`}>
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{event.name}</h3>
                <Badge>{event.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {event.format} • Match registration: {event.entryFeeCoins} NV Tokens • {event.reservedSlots}/{event.maxSlots}
              </p>
            </Card>
          </Link>
        ))
      )}
      <p className="text-xs text-[var(--muted)]">{settings.clashWarning}</p>
    </div>
  );
}

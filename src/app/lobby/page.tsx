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
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">Wallet</p>
        <p className="mt-1 text-3xl font-extrabold">{user?.availableCoins ?? 0} NV</p>
        <p className="text-sm text-[var(--muted)]">Locked {user?.lockedCoins ?? 0} • 10 NV = ₹1</p>
      </Card>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Open Clash Squad</h1>
        <Button asChild size="sm">
          <Link href="/clash/new">Post match</Link>
        </Button>
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No open challenges yet.</p>
      ) : (
        matches.map((match) => (
          <Link key={String(match._id)} href={`/clash/${String(match._id)}`}>
            <Card>
              <div className="flex items-center justify-between">
                <Badge>{match.format}v{match.format}</Badge>
                <span className="text-sm font-semibold">
                  {match.stakeMin}–{match.stakeMax} NV
                </span>
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
                {event.format} • {event.entryFeeCoins} NV • {event.reservedSlots}/{event.maxSlots}
              </p>
            </Card>
          </Link>
        ))
      )}
      <p className="text-xs text-[var(--muted)]">{settings.clashWarning}</p>
    </div>
  );
}

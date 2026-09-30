import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEventDetail } from "@/services/event.service";
import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registerEventAction } from "@/app/actions/event";
import { UserRole } from "@/types/enums";
import {
  CalendarDays,
  Coins,
  Crown,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const isAdmin = session.user.role === UserRole.ADMIN;
  const { event } = await getEventDetail(id, isAdmin);
  const canPay =
    event.status === "published" || event.status === "registration_open";
  const freeEntry = event.entryFeeCoins === 0;
  const configuredFreeEntryPrizePool = Number(event.winningPrizeCoins);
  const prizePool = freeEntry
    ? Number.isFinite(configuredFreeEntryPrizePool) && configuredFreeEntryPrizePool > 0
      ? configuredFreeEntryPrizePool
      : 0
    : event.reservedSlots * event.entryFeeCoins;
  const prizeFor = (percent: number) => Math.floor((prizePool * percent) / 100);
  const [startHour, startMinute] = event.startTime.split(":").map(Number);
  const startTime = `${startHour % 12 || 12}:${String(startMinute).padStart(2, "0")} ${startHour >= 12 ? "PM" : "AM"}`;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 pb-2">
      <Card className="relative overflow-hidden border-white/15 bg-transparent p-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/br.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080d14]/95 via-[#080d14]/82 to-[#080d14]/45" />
        <div className="relative p-5 text-white sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[var(--accent-2)]">
                <Trophy size={17} />
                <p className="text-xs font-bold uppercase tracking-[0.16em]">
                  Battle royale event
                </p>
              </div>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight">
                {event.name}
              </h1>
            </div>
            <Badge className="ml-3 shrink-0 border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15">
              {event.status}
            </Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <CalendarDays size={16} className="text-[var(--accent)]" />
              <div>
                <p className="text-white/55">Starts</p>
                <p className="mt-0.5 font-bold">
                  {new Date(event.eventDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {startTime}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <UsersRound size={16} className="text-[var(--accent)]" />
              <div>
                <p className="text-white/55">Lobby</p>
                <p className="mt-0.5 font-bold">
                  {event.reservedSlots}/{event.maxSlots} slots
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <Coins size={15} className="text-yellow-300" />{" "}
              {freeEntry ? "Free entry" : `${event.entryFeeCoins} NV entry`}
            </span>
            <span className="font-bold text-[var(--accent-2)]">
              {event.format}
            </span>
          </div>
          <p className="mt-2 text-sm">
            Skill {event.characterSkill ? "On" : "Off"} • Unlimited gloo{" "}
            {event.unlimitedGlooWall ? "On" : "Off"}
          </p>
          {event.customNotes ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {event.customNotes}
            </p>
          ) : null}
          {event.roomId || event.roomPassword ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <h2 className="font-bold">Room details</h2>
              {event.roomId ? (
                <p className="mt-1">Room ID: {event.roomId}</p>
              ) : null}
              {event.roomPassword ? (
                <p>Room password: {event.roomPassword}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
      <Card className="border-white/10">
        <div className="mb-3 flex items-center gap-2">
          <Crown size={18} className="text-yellow-300" />
          <h2 className="font-bold">
            Prize pool
          </h2>
        </div>
        <p className="text-2xl font-black">
          {prizePool}{" "}
          <span className="text-base text-[var(--muted)]">NV Tokens</span>
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {freeEntry
            ? "Free entry • prize funded by the organizer"
            : `${event.reservedSlots} registrations × ${event.entryFeeCoins} NV entry`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-yellow-400/10 p-2.5">
            <p className="text-yellow-300">1st</p>
            <p className="mt-1 font-bold">
              {prizeFor(event.prizeDistribution.first)}{" "}
              NV
            </p>
          </div>
          <div className="rounded-xl bg-white/8 p-2.5">
            <p className="text-white/70">2nd</p>
            <p className="mt-1 font-bold">
              {prizeFor(event.prizeDistribution.second)} NV
            </p>
          </div>
          <div className="rounded-xl bg-orange-400/10 p-2.5">
            <p className="text-orange-300">3rd</p>
            <p className="mt-1 font-bold">
              {prizeFor(event.prizeDistribution.third)} NV
            </p>
          </div>
        </div>
      </Card>
      {canPay ? (
        <Card className="border-[var(--accent)]/30 bg-gradient-to-br from-[var(--card)] to-[#17120e]">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--accent)]" />
            <h2 className="font-bold">Register for event</h2>
          </div>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Your saved In Game Name from Profile will be used automatically.
          </p>
          <ActionForm
            action={registerEventAction}
            submitLabel="Confirm registration"
          >
            <input type="hidden" name="eventId" value={id} />
          </ActionForm>
        </Card>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Registration is not open for this event.
        </p>
      )}
    </div>
  );
}

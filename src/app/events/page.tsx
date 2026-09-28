import Link from "next/link";
import { listPublicEvents } from "@/services/event.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, Coins, Trophy, UsersRound } from "lucide-react";

export default async function EventsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const events = await listPublicEvents();

  return (
    <div className="grid gap-5 pb-2">
      <div>
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Trophy size={18} />
          <p className="text-xs font-bold uppercase tracking-[0.16em]">Tournament hub</p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold">Competitive events</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Join the next battle and play for the prize pool.</p>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>
      ) : (
        events.map((event) => (
          <Link key={String(event._id)} href={`/events/${String(event._id)}`} className="group block">
            <Card className="relative overflow-hidden border-white/15 p-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--accent-2)]/65 group-hover:shadow-[0_18px_44px_rgba(0,224,198,0.12)]">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/br.png')" }} />
              <div className="absolute inset-0 bg-gradient-to-r from-[#080d14]/95 via-[#080d14]/80 to-[#080d14]/45" />
              <div className="relative p-4 text-white sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-2)]">Battle royale event</p>
                    <h2 className="mt-1 truncate text-lg font-extrabold">{event.name}</h2>
                  </div>
                  <Badge className="shrink-0 border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15">{event.status}</Badge>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"><CalendarDays size={15} className="text-[var(--accent)]" /><span>{new Date(event.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"><UsersRound size={15} className="text-[var(--accent)]" /><span>{event.reservedSlots}/{event.maxSlots} slots</span></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-white/80"><Coins size={14} className="text-yellow-300" /> {event.entryFeeCoins} NV <span className="text-white/35">•</span> {event.format}</p>
                  <div className="flex items-center gap-1 font-bold text-[var(--accent-2)]">View event <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></div>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

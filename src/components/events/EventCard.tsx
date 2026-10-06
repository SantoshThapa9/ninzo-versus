import Link from "next/link";
import { CalendarDays, ChevronRight, Coins, UsersRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EventCardProps = {
  event: {
    _id: string | number;
    name: string;
    customNotes?: string | null;
    status: string;
    eventDate: string | Date;
    reservedSlots: number;
    maxSlots: number;
    entryFeeCoins: number;
    format: string;
  };
};

export function EventCard({ event }: EventCardProps) {
  return (
    <Link
      key={String(event._id)}
      href={`/events/${String(event._id)}`}
      className="group block min-w-0"
    >
      <Card className="relative overflow-hidden border-white/15 p-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--accent-2)]/65 group-hover:shadow-[0_18px_44px_rgba(0,224,198,0.12)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/br.png')" }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#080d14]/95 via-[#080d14]/80 to-[#080d14]/45" />

        <div className="relative p-4 text-white sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-2)]">
                Battle royale event
              </p>
              <h3 className="mt-1 truncate text-lg font-extrabold">
                {event.name}
              </h3>
              <p className="min-w-0 break-words text-sm text-[var(--muted)]">
                {event.customNotes}
              </p>
            </div>

            <Badge className="shrink-0 border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/15 text-[var(--accent-2)]">
              {event.status}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
              <CalendarDays size={15} className="text-[var(--accent)]" />

              <span>
                {new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
              <UsersRound size={15} className="text-[var(--accent)]" />

              <span>
                {event.reservedSlots}/{event.maxSlots} slots
              </span>
            </div>
          </div>

          <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-xs">
            <p className="min-w-0 break-words flex items-center gap-1.5 font-semibold text-white/80">
              <Coins size={14} className="shrink-0 text-yellow-300" />
              <span className="min-w-0 break-words">
                {event.entryFeeCoins} NV
                <span className="mx-1 text-white/35">•</span>
                {event.format}
              </span>
            </p>

            <div className="flex shrink-0 items-center gap-1 font-bold text-[var(--accent-2)]">
              View event
              <ChevronRight
                size={16}
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

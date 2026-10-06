import Image from "next/image";
import { Card } from "@/components/ui/card";
import { getPlayerRank } from "@/services/rank.service";
import { auth } from "@/auth";
import { getRank } from "@/lib/rank";

export async function PlayerRankCard() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  const playerRank = await getPlayerRank(userId);

  if (!playerRank) return null;

  const rankInfo = getRank(playerRank.rankScore);

  return (
    <Card
      className="
        relative overflow-hidden
        border border-[var(--accent)]/20
        bg-gradient-to-br from-[var(--accent)]/10 via-background to-background
        p-0
        shadow-sm
      "
    >
      {/* Accent glow */}
      <div
        className="
          pointer-events-none absolute -right-8 -top-8
          h-24 w-24 rounded-full
          bg-[var(--accent)]/15 blur-2xl
        "
      />

      <div className="relative flex items-center gap-3 px-3 py-2.5">
        {/* Rank Badge */}
        <div
          className="
            flex size-12 shrink-0 items-center justify-center
            rounded-xl
            border border-[var(--accent)]/20
            bg-background/70
            shadow-inner
          "
        >
          <Image
            src={rankInfo.image}
            alt={playerRank.rank}
            width={34}
            height={34}
            className="size-8 object-contain drop-shadow-sm"
          />
        </div>

        {/* Player Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            Current Season
          </p>

          <p
            className={`truncate text-base font-black leading-tight ${rankInfo.className}`}
          >
            {playerRank.rank}
          </p>

          <p className="truncate text-[11px] font-semibold text-[var(--muted)]">
            {playerRank.ign}
          </p>
        </div>

        {/* Score */}
        <div className="border-l border-border/60 pl-3 text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Score
          </p>

          <p className="text-xl font-black leading-none">
            {playerRank.rankScore}
          </p>

          <p className="mt-1 text-[10px] font-bold">
            <span>{playerRank.wins}W</span>
            <span className="mx-1 text-[var(--muted)]">/</span>
            <span>{playerRank.losses}L</span>
          </p>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
    </Card>
  );
}

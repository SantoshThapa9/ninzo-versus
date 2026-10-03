import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { userRepository } from "@/repositories/user.repository";
import { logoutAction } from "@/app/actions/auth";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPlayerRank } from "@/services/rank.service";
import { getRank } from "@/lib/rank";
import { normalizeLastMatchPlayed } from "@/lib/last-match-played";
import { Medal } from "lucide-react";
import Link from "next/link";
import { NotificationToggle } from "@/components/profile/notification-toggle";

export default async function ProfilePage() {
  const session = await auth();
  await connectDb();
  const userId = session?.user?.id;
  const [user, profile, playerRank] = userId
    ? await Promise.all([
        userRepository.findByIdLean(userId),
        playerProfileRepository.findByUserId(userId),
        getPlayerRank(userId),
      ])
    : [null, null, null];

  // The user document is the source shown in the profile form. The legacy
  // PlayerProfile values remain as a fallback for accounts not yet backfilled.
  const ign = user?.ign ?? profile?.ign ?? "";
  const uid = user?.uid ?? profile?.uid ?? "";
  const lastMatchPlayed = normalizeLastMatchPlayed(user?.lastMatchPlayed);
  return (
    <div className="grid gap-4">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">
          {user?.displayName ?? session?.user?.name ?? "Your player profile"}
        </h1>
        <p className="mb-4 text-sm text-[var(--muted)]">
          {user?.email ??
            session?.user?.email ??
            "Sign in to save your game details."}
        </p>
        {/* <p className="mb-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--muted)]">
          Display name and age can each be changed once every 24 hours. In Game
          Name and UID share a 24-hour limit, as do UPI ID and phone number.
        </p> */}
        <details className="mt-2 mb-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-muted transition-colors hover:text-foreground">
            <span className="flex items-center gap-2">
              <span className="text-accent">ⓘ</span>
              In-game name format
            </span>

            <span className="text-xs opacity-60">▼</span>
          </summary>

          <div className="border-t border-white/10  pb-3 pt-2.5 leading-relaxed text-muted">
            <p className="px-3">
              Exact in-game name is not required. Please enter your full in-game
              name as accurately as possible.
            </p>
            <div className="mt-2  bg-black/20 px-2.5 py-2">
              <p className="text-xs text-muted">Example:</p>
              <p className="mt-1 font-mono text-foreground">
                ᶜᵐ ₦Ї₦ƵØ ʟɪᴠᴇ! ➜ cm ninzo live!
              </p>
            </div>
          </div>
        </details>
        {userId ? (
          <ProfileDetailsForm
            key={`profile-age-${user?.age ?? "unset"}`}
            displayName={user?.displayName ?? ""}
            ign={ign}
            uid={uid}
            age={user?.age ?? null}
            upiId={user?.upiId ?? ""}
            phoneNumber={user?.phoneNumber ?? ""}
          />
        ) : (
          <>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  disabled
                  placeholder="Shown on rankings"
                />
              </div>
              <div>
                <Label htmlFor="ign">In Game Name</Label>
                <Input
                  id="ign"
                  disabled
                  placeholder="Your Free Fire name"
                  data-tour="ign"
                />
              </div>
              <div>
                <Label htmlFor="uid">Free Fire UID</Label>
                <Input
                  id="uid"
                  disabled
                  placeholder="Your Free Fire UID"
                  data-tour="uid"
                />
              </div>
            </div>
            <Button asChild size="full">
              <Link href="/login?callbackUrl=/profile">
                Sign in to save profile
              </Link>
            </Button>
          </>
        )}
        {userId ? <NotificationToggle /> : null}
      </Card>
      {playerRank
        ? (() => {
            const rank = getRank(playerRank.winRate);
            return (
              <Card className="border-[var(--accent)]/25">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Current season rank
                    </p>
                    <p
                      className={`mt-1 flex items-center gap-2 text-xl font-extrabold ${rank.className}`}
                    >
                      <Medal size={20} />
                      {playerRank.rank}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold">
                      {playerRank.winRate}%
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {playerRank.wins} wins / {playerRank.matches} matches
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Last match played:{" "}
                  {lastMatchPlayed
                    ? lastMatchPlayed.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata",
                      })
                    : "No last match date recorded"}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {
                    "Inactivity for a full day adds 1 default decay match, lowering your win rate. Play at least one match daily to prevent this."
                  }
                </p>
              </Card>
            );
          })()
        : null}
      {userId ? (
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" size="full">
            Sign out
          </Button>
        </form>
      ) : null}
    </div>
  );
}

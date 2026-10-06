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
import Image from "next/image";
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
      {/* {playerRank
        ? (() => {
            const rank = getRank(playerRank.rankScore);
            return (
              <Card className="border-[var(--accent)]/25 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold uppercase leading-tight text-[var(--muted)]">
                      Current season rank
                    </p>

                    <p
                      className={`mt-2 flex items-center gap-1.5 text-lg font-extrabold ${rank.className}`}
                    >
                      <Image
                        src={rank.image}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 shrink-0 object-contain"
                      />
                      {playerRank.rank}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold leading-tight mb-1">
                      {playerRank.rankScore}
                    </p>

                    <p className="text-[11px] leading-tight text-[var(--muted)]">
                      Rank Score · {playerRank.wins}W / {playerRank.losses}L
                    </p>
                  </div>
                </div>
              </Card>
            );
          })()
        : null} */}

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

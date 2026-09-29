import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { userRepository } from "@/repositories/user.repository";
import { saveProfileAction } from "@/app/actions/wallet";
import { logoutAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPlayerRank } from "@/services/rank.service";
import { getRank } from "@/lib/rank";
import { Medal } from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await auth();
  await connectDb();
  const userId = session?.user?.id;
  const [user, profile, playerRank] = userId
    ? await Promise.all([
        userRepository.findById(userId),
        playerProfileRepository.findByUserId(userId),
        getPlayerRank(userId),
      ])
    : [null, null, null];

  // The user document is the source shown in the profile form. The legacy
  // PlayerProfile values remain as a fallback for accounts not yet backfilled.
  const ign = user?.ign ?? profile?.ign ?? "";
  const uid = user?.uid ?? profile?.uid ?? "";

  return (
    <div className="grid gap-4">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">
          {user?.displayName ?? session?.user?.name ?? "Your player profile"}
        </h1>
        <p className="mb-4 text-sm text-[var(--muted)]">
          {user?.email ?? session?.user?.email ?? "Sign in to save your game details."}
        </p>
        <p className="mb-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--muted)]">
          You can update your In Game Name and Free Fire UID once every 24 hours. Changes appear in active matches, private chat, and booked tournaments; completed match records keep their original names.
        </p>
        {userId ? <ActionForm action={saveProfileAction} submitLabel="Save profile">
          <div>
            <Label htmlFor="ign">In Game Name</Label>
            <Input id="ign" name="ign" defaultValue={ign} required data-tour="ign" />
          </div>
          <div>
            <Label htmlFor="uid">Free Fire UID</Label>
            <Input id="uid" name="uid" defaultValue={uid} data-tour="uid" />
          </div>
        </ActionForm> : <>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="ign">In Game Name</Label>
              <Input id="ign" disabled placeholder="Your Free Fire name" data-tour="ign" />
            </div>
            <div>
              <Label htmlFor="uid">Free Fire UID</Label>
              <Input id="uid" disabled placeholder="Your Free Fire UID" data-tour="uid" />
            </div>
          </div>
          <Button asChild size="full"><Link href="/login?callbackUrl=/profile">Sign in to save profile</Link></Button>
        </>}
      </Card>
      {playerRank ? (() => {
        const rank = getRank(playerRank.winRate);
        return (
          <Card className="border-[var(--accent)]/25">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Your rank</p><p className={`mt-1 flex items-center gap-2 text-xl font-extrabold ${rank.className}`}><Medal size={20} />{playerRank.rank}</p></div>
              <div className="text-right"><p className="text-2xl font-extrabold">{playerRank.winRate}%</p><p className="text-xs text-[var(--muted)]">{playerRank.wins} wins / {playerRank.matches} matches</p></div>
            </div>
          </Card>
        );
      })() : null}
      {userId ? <form action={logoutAction}>
        <Button type="submit" variant="secondary" size="full">
          Sign out
        </Button>
      </form> : null}
    </div>
  );
}

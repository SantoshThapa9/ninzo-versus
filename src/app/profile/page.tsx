import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const [user, profile] = await Promise.all([
    userRepository.findById(session.user.id),
    playerProfileRepository.findByUserId(session.user.id),
  ]);

  // The user document is the source shown in the profile form. The legacy
  // PlayerProfile values remain as a fallback for accounts not yet backfilled.
  const ign = user?.ign ?? profile?.ign ?? "";
  const uid = user?.uid ?? profile?.uid ?? "";

  return (
    <div className="grid gap-4">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">
          {user?.displayName ?? session.user.name}
        </h1>
        <p className="mb-4 text-sm text-[var(--muted)]">
          {user?.email ?? session.user.email}
        </p>
        <p className="mb-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--muted)]">
          You can update your In Game Name and Free Fire UID once every 24 hours. Changes appear in active matches, private chat, and booked tournaments; completed match records keep their original names.
        </p>
        <ActionForm action={saveProfileAction} submitLabel="Save profile">
          <div>
            <Label htmlFor="ign">In Game Name</Label>
            <Input id="ign" name="ign" defaultValue={ign} required />
          </div>
          <div>
            <Label htmlFor="uid">Free Fire UID</Label>
            <Input id="uid" name="uid" defaultValue={uid} />
          </div>
        </ActionForm>
      </Card>
      <form action={logoutAction}>
        <Button type="submit" variant="secondary" size="full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

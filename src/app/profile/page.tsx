import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db/mongoose";
import { playerProfileRepository } from "@/repositories/player-profile.repository";
import { saveProfileAction } from "@/app/actions/wallet";
import { logoutAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const profile = await playerProfileRepository.findByUserId(session.user.id);

  return (
    <div className="grid gap-4">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">{session.user.name}</h1>
        <p className="mb-4 text-sm text-[var(--muted)]">{session.user.email}</p>
        <form action={saveProfileAction} className="grid gap-3">
          <div>
            <Label htmlFor="ign">Free Fire IGN</Label>
            <Input id="ign" name="ign" defaultValue={profile?.ign ?? ""} required />
          </div>
          <div>
            <Label htmlFor="uid">Free Fire UID</Label>
            <Input id="uid" name="uid" defaultValue={profile?.uid ?? ""} />
          </div>
          <Button type="submit" size="full">
            Save profile
          </Button>
        </form>
      </Card>
      <form action={logoutAction}>
        <Button type="submit" variant="secondary" size="full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

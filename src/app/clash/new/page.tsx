import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createMatchAction } from "@/app/actions/match";
import { getPlatformSettings } from "@/services/settings.service";
import { CLASH_DEFAULTS } from "@/config/defaults";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db/mongoose";
import { playerProfileRepository } from "@/repositories/player-profile.repository";

export default async function NewClashPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const settings = await getPlatformSettings();
  await connectDb();
  const profile = await playerProfileRepository.findByUserId(session.user.id);

  return (
    <Card>
      <h1 className="mb-3 text-2xl font-bold">Post Clash Squad</h1>
      <p className="mb-4 text-sm text-[var(--danger)]">{settings.clashWarning}</p>
      <ActionForm action={createMatchAction} submitLabel="Lock max stake">
        <div>
          <Label htmlFor="format">Team size</Label>
          <select id="format" name="format" className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3">
            {CLASH_DEFAULTS.teamSizes.map((size) => (
              <option key={size} value={size}>
                {size}v{size}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="stakeMin">Stake min (NV)</Label>
          <Input id="stakeMin" name="stakeMin" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="stakeMax">Stake max (NV) — this amount is locked</Label>
          <Input id="stakeMax" name="stakeMax" type="number" min={1} required />
        </div>
        <div>
          <Label htmlFor="ign">Free Fire IGN (saved before lock)</Label>
          <Input id="ign" name="ign" defaultValue={profile?.ign ?? ""} required />
        </div>
        <div>
          <Label htmlFor="rules">Rules</Label>
          <Textarea id="rules" name="rules" required />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="warning" required className="mt-1" />
          I checked custom-room settings and understand START screenshots are required.
        </label>
      </ActionForm>
    </Card>
  );
}

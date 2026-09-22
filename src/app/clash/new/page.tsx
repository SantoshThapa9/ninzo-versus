import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createMatchAction } from "@/app/actions/match";
import { getPlatformSettings } from "@/services/settings.service";
import { CLASH_DEFAULTS, ECONOMY_DEFAULTS } from "@/config/defaults";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function NewClashPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const settings = await getPlatformSettings();

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
          <Label htmlFor="stakeMin">Stake min (NV) — minimum 10 NV</Label>
          <Input id="stakeMin" name="stakeMin" type="number" min={ECONOMY_DEFAULTS.minMatchStakeCoins} required />
        </div>
        <div>
          <Label htmlFor="stakeMax">Stake max (NV) — this amount is locked</Label>
          <Input id="stakeMax" name="stakeMax" type="number" min={ECONOMY_DEFAULTS.minMatchStakeCoins} required />
        </div>
        <p className="text-sm text-[var(--muted)]">Your saved In Game Name and UID from your profile will be used for this match.</p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="onlyHeadshots" className="mt-0.5" />
            Only headshots allowed
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="characterSkillAllowed" className="mt-0.5" />
            Character skill allowed
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="warning" required className="mt-1" />
          I checked the custom-room settings and agree to follow the match rules.
        </label>
      </ActionForm>
    </Card>
  );
}

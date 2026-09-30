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
      <h1 className="mb-3 text-2xl font-bold">Create a challenge post</h1>

      <p className="mb-4 flex items-center gap-3 rounded-xl border border-amber-400 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300">
        <span className="text-lg">⚠</span>
        <span>
          After the match: Both the winner and loser must upload a result
          screenshot.
        </span>
      </p>
      <ActionForm
        action={createMatchAction}
        submitLabel="Register challenge with NV Tokens"
      >
        <div>
          <Label htmlFor="format">Team size</Label>
          <select
            id="format"
            name="format"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3"
          >
            {CLASH_DEFAULTS.teamSizes.map((size) => (
              <option key={size} value={size}>
                {size}v{size}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Opponent will choose challenge tokens from the minimum to the maximum.
        </p>

        <div>
          <Label htmlFor="stakeMin">
            Minimum Challenge Tokens (min {ECONOMY_DEFAULTS.minMatchStakeCoins})
          </Label>
          <Input
            id="stakeMin"
            name="stakeMin"
            type="number"
            min={ECONOMY_DEFAULTS.minMatchStakeCoins}
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="stakeMax">Maximum Challenge Tokens</Label>
          <Input
            id="stakeMax"
            name="stakeMax"
            type="number"
            min={ECONOMY_DEFAULTS.minMatchStakeCoins}
            step="0.01"
            required
          />
        </div>
        <p className="text-sm text-[var(--muted)]">
          Your saved In Game Name and UID from your profile will be used for
          this match.
        </p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="onlyHeadshots" className="mt-0.5" />
            Only headshots
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="characterSkillAllowed"
              className="mt-0.5"
            />
            Character skill
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="warning" required className="mt-1" />I
          checked the custom-room settings and agree to follow the match rules.
        </label>
      </ActionForm>
    </Card>
  );
}

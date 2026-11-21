import { ActionForm } from "@/components/forms/action-form";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createMatchAction } from "@/app/actions/match";
import { CLASH_DEFAULTS, ECONOMY_DEFAULTS } from "@/config/defaults";
import { EVENT_ROUNDS } from "@/types/enums";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TokenRangeFields } from "@/components/match/token-range-fields";

export default async function NewClashPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden p-0">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-3">
        <p className="mb-1 text-sm font-medium text-amber-400">New Challenge</p>

        <h1 className="text-2xl font-bold tracking-tight">
          Create a challenge post
        </h1>
      </div>

      <ActionForm
        action={createMatchAction}
        submitLabel="Register challenge with NV Tokens"
      >
        <div className="space-y-6 p-4">
          {/* Match Settings */}
          <section className="space-y-3">
            {/* Team Size */}
            <div className="space-y-2">
              <Label htmlFor="format">Team size</Label>

              <select
                id="format"
                name="format"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10"
              >
                {CLASH_DEFAULTS.teamSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}v{size}
                  </option>
                ))}
              </select>
            </div>

            {/* Rounds */}
            <div className="space-y-2">
              <Label htmlFor="rounds">Rounds</Label>

              <select
                id="rounds"
                name="rounds"
                defaultValue={7}
                required
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10"
              >
                {EVENT_ROUNDS.map((rounds) => (
                  <option key={rounds} value={rounds}>
                    {rounds} rounds
                  </option>
                ))}
              </select>
            </div>

            {/* Match Rules */}
            <div className="grid gap-2 sm:grid-cols-2">
              {/* Headshots */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium">Only headshots</p>

                <div className="mt-2 flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition has-[:checked]:border-emerald-400/50 has-[:checked]:bg-emerald-400/10">
                    <input
                      type="radio"
                      name="onlyHeadshots"
                      value="yes"
                      defaultChecked
                      className="accent-emerald-400"
                    />
                    Yes
                  </label>

                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition has-[:checked]:border-red-400/50 has-[:checked]:bg-red-400/10">
                    <input
                      type="radio"
                      name="onlyHeadshots"
                      value="no"
                      className="accent-red-400"
                    />
                    No
                  </label>
                </div>
              </div>

              {/* Character Skill */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-medium">Character skill</p>

                <div className="mt-2 flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition has-[:checked]:border-emerald-400/50 has-[:checked]:bg-emerald-400/10">
                    <input
                      type="radio"
                      name="characterSkillAllowed"
                      value="yes"
                      className="accent-emerald-400"
                    />
                    Yes
                  </label>

                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition has-[:checked]:border-red-400/50 has-[:checked]:bg-red-400/10">
                    <input
                      type="radio"
                      name="characterSkillAllowed"
                      value="no"
                      defaultChecked
                      className="accent-red-400"
                    />
                    No
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Token Range */}
          <TokenRangeFields minStake={ECONOMY_DEFAULTS.minMatchStakeCoins} />

          {/* Warning */}
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 pl-4">
            <div className="flex items-center gap-2">
              <span className=" text-lg text-amber-400">⚠</span>

              <p className="text-sm font-semibold text-amber-300">
                Match result requirement
              </p>
            </div>
            <p className="mt-1 text-sm leading-6 text-amber-200/80">
              After the match, both the winner and loser must upload a result
              screenshot.
            </p>
          </div>

          {/* Agreement */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
            <input
              type="checkbox"
              name="warning"
              required
              className="mt-1 h-4 w-4 accent-emerald-400"
            />

            <span className="leading-6 text-[var(--muted)]">
              I have read the custom-room warning and agree to follow all match
              rules and instructions.
            </span>
          </label>
        </div>
      </ActionForm>
    </Card>
  );
}

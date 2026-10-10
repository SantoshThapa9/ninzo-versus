"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TokenRangeFieldsProps = {
  minStake: number;
};

export function TokenRangeFields({ minStake }: TokenRangeFieldsProps) {
  const [stakeMin, setStakeMin] = useState(String(minStake));
  const [stakeMax, setStakeMax] = useState("");

  const useSameAmount = () => {
    setStakeMax(stakeMin);
  };

  return (
    <div className="space-y-2">
      {/* Minimum */}
      <div className="space-y-2">
        <Label htmlFor="stakeMin">Minimum Challenge Tokens</Label>

        <Input
          id="stakeMin"
          name="stakeMin"
          type="number"
          min={minStake}
          step="0.01"
          required
          value={stakeMin}
          onChange={(e) => setStakeMin(e.target.value)}
          placeholder={`Minimum ${minStake}`}
        />
      </div>

      {/* Maximum */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="stakeMax">Maximum Challenge Tokens</Label>

          <button
            type="button"
            onClick={useSameAmount}
            disabled={!stakeMin}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use same
          </button>
        </div>

        <Input
          id="stakeMax"
          name="stakeMax"
          type="number"
          min={minStake}
          step="0.01"
          required
          value={stakeMax}
          onChange={(e) => setStakeMax(e.target.value)}
          placeholder="Maximum tokens"
        />
      </div>
    </div>
  );
}

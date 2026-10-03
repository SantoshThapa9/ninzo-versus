"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  devSeedAction,
  type DevSeedActionResult,
} from "@/app/actions/dev-seed";
import type { DevDummyUser } from "@/services/dev-seed.service";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function ResultMessage({ result }: { result: DevSeedActionResult | null }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200"
      >
        {result.error}
      </p>
    );
  }

  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100"
    >
      Dummy user {result.created ? "created" : "updated"}: {result.user.ign} (
      {result.user.wins} wins / {result.user.matchesPlayed} matches).
    </p>
  );
}

export function DevSeedForm({ users }: { users: DevDummyUser[] }) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ign, setIgn] = useState("");
  const [matchesPlayed, setMatchesPlayed] = useState("");
  const [wins, setWins] = useState("");
  const [result, setResult] = useState<DevSeedActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    const user = users.find((item) => item.id === userId);
    setDisplayName(user?.displayName ?? "");
    setIgn(user?.ign ?? "");
    setMatchesPlayed(user?.matchesPlayed ?? "");
    setWins(user?.wins ?? "");
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const actionResult = await devSeedAction(
        { displayName, ign, matchesPlayed, wins },
        selectedUserId || undefined,
      );
      setResult(actionResult);
      if (actionResult.ok) {
        setSelectedUserId(actionResult.user.id);
        router.refresh();
      }
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <Card className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="seed-existing-user">Dummy user</Label>
          <select
            id="seed-existing-user"
            value={selectedUserId}
            onChange={(event) => selectUser(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--accent)]"
          >
            <option value="">New dummy user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {user.ign}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--muted)]">
            Existing users in this list are dummy accounts created by this
            tool. Other accounts are never modified.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="seed-display-name">Display Name</Label>
          <input
            id="seed-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            minLength={2}
            maxLength={24}
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="seed-ign">IGN</Label>
          <input
            id="seed-ign"
            value={ign}
            onChange={(event) => setIgn(event.target.value)}
            required
            minLength={2}
            maxLength={20}
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="seed-matches-played">Matches Played</Label>
            <input
              id="seed-matches-played"
              type="number"
              value={matchesPlayed}
              onChange={(event) => setMatchesPlayed(event.target.value)}
              required
              min={0}
              step={1}
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seed-wins">Wins</Label>
            <input
              id="seed-wins"
              type="number"
              value={wins}
              onChange={(event) => setWins(event.target.value)}
              required
              min={0}
              step={1}
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </Card>

      <p className="text-xs text-[var(--muted)]">
        Dummy users rank from these saved user counters in the selected season.
        No match records are created.
      </p>
      <ResultMessage result={result} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Seed User"}
      </button>
    </form>
  );
}

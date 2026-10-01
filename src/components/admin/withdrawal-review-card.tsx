"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Input } from "@/components/ui/input";
import { reviewWithdrawalAction } from "@/app/actions/wallet";

type TokenTransaction = { id: string; label: string; amount: number; availableAfter: number; createdAt: string };

export function WithdrawalReviewCard({ withdrawal, user, initialTransactions, initialCursor }: {
  withdrawal: { id: string; coins: number; status: string; upiId: string };
  user: { displayName: string; email: string; availableCoins: number } | null;
  initialTransactions: TokenTransaction[];
  initialCursor: string | null;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchMore() {
    if (!cursor || loading || transactions.length >= 100) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawal.id}/token-flow?cursor=${encodeURIComponent(cursor)}`);
      const page = await response.json() as { transactions?: TokenTransaction[]; nextCursor?: string | null; error?: string };
      if (!response.ok) throw new Error(page.error ?? "Could not load token flow.");
      const remaining = 100 - transactions.length;
      const next = (page.transactions ?? []).slice(0, remaining);
      setTransactions((current) => {
        const known = new Set(current.map((transaction) => transaction.id));
        return [...current, ...next.filter((transaction) => !known.has(transaction.id))];
      });
      setCursor(remaining <= next.length ? null : page.nextCursor ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load token flow.");
    } finally { setLoading(false); }
  }

  return <Card className="w-full min-w-0 max-w-full overflow-hidden">
    <div className="flex min-w-0 items-center justify-between gap-3"><p className="min-w-0 truncate font-bold">{withdrawal.coins} NV Tokens</p><Badge className="shrink-0">{withdrawal.status}</Badge></div>
    <p className="mt-1 min-w-0 break-words text-sm text-[var(--muted)]">{user?.displayName ?? "Deleted user"} · {user?.email ?? "Account unavailable"}</p>
    <p className="mt-1 min-w-0 break-all text-sm text-[var(--muted)]">UPI {withdrawal.upiId} · Current balance {user?.availableCoins ?? "—"} NV</p>
    <div className="mt-3 min-w-0 rounded-xl border border-white/8 bg-black/15 p-3"><p className="text-xs font-semibold">Recent token flow</p>
      <div className="mt-2 h-52 overflow-y-auto pr-1 text-xs">
        {transactions.length === 0 ? <p className="text-[var(--muted)]">No ledger entries found.</p> : <div className="grid gap-2">{transactions.map((transaction) => <div key={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-white/5 pb-2 last:border-0"><span className="truncate">{transaction.label}</span><span className={transaction.amount >= 0 ? "text-[var(--accent-2)]" : "text-white/75"}>{transaction.amount >= 0 ? "+" : ""}{transaction.amount} NV</span><span className="text-[var(--muted)]">{new Date(transaction.createdAt).toLocaleString("en-IN")}</span><span className="text-[var(--muted)]">Balance {transaction.availableAfter} NV</span></div>)}</div>}
      </div>
      {cursor && transactions.length < 100 ? <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={fetchMore} disabled={loading}>{loading ? "Loading..." : "Fetch more"}</Button> : null}
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
    <form action={reviewWithdrawalAction} className="mt-3 grid min-w-0 gap-2"><input type="hidden" name="withdrawalId" value={withdrawal.id} /><Input name="note" placeholder="Admin note (optional)" className="min-w-0 max-w-full" /><div className="flex min-w-0 flex-wrap gap-2"><PendingSubmitButton name="action" value="approve" size="sm" pendingLabel="Processing...">Approve</PendingSubmitButton><PendingSubmitButton name="action" value="paid" size="sm" variant="secondary" pendingLabel="Processing...">Mark paid</PendingSubmitButton><PendingSubmitButton name="action" value="reject" size="sm" variant="danger" pendingLabel="Processing...">Reject & refund</PendingSubmitButton></div></form>
  </Card>;
}

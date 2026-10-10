"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { Input } from "@/components/ui/input";
import { reviewWithdrawalAction } from "@/app/actions/wallet";

type TokenTransaction = {
  id: string;
  label: string;
  amount: number;
  availableDelta: number;
  lockedDelta: number;
  availableBefore: number;
  lockedBefore: number;
  availableAfter: number;
  lockedAfter: number;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

type WithdrawalSnapshot = {
  requestedAmount: number;
  availableBeforeReservation: number;
  lockedBeforeReservation: number;
  totalBeforeReservation: number;
  availableAfterReservation: number;
  lockedAfterReservation: number;
  totalAfterReservation: number;
};

type PreviousWithdrawal = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  processedAt: string | null;
  current: boolean;
};

type WithdrawalHistory = {
  transactions: TokenTransaction[];
  nextCursor: string | null;
  withdrawalSnapshot: WithdrawalSnapshot | null;
  previousWithdrawals: PreviousWithdrawal[];
  resetAt: string | null;
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

export function WithdrawalReviewCard({
  withdrawal,
  user,
  initialHistory,
}: {
  withdrawal: {
    id: string;
    coins: number;
    status: string;
    upiId: string;
    createdAt: string;
  };
  user: {
    displayName: string;
    email: string;
    availableCoins: number;
    lockedCoins: number;
  } | null;
  initialHistory: WithdrawalHistory;
}) {
  const [transactions, setTransactions] = useState(initialHistory.transactions);
  const [cursor, setCursor] = useState(initialHistory.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/withdrawals/${withdrawal.id}/token-flow?cursor=${encodeURIComponent(cursor)}`,
      );
      const page = (await response.json()) as Partial<WithdrawalHistory> & {
        error?: string;
      };
      if (!response.ok) throw new Error(page.error ?? "Could not load token history.");
      const next = page.transactions ?? [];
      setTransactions((current) => {
        const known = new Set(current.map((transaction) => transaction.id));
        return [...current, ...next.filter((transaction) => !known.has(transaction.id))];
      });
      setCursor(page.nextCursor ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load token history.");
    } finally {
      setLoading(false);
    }
  }

  const snapshot = initialHistory.withdrawalSnapshot;

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate font-bold">
          Withdrawal request · {withdrawal.coins} NV
        </p>
        <Badge className="shrink-0">{withdrawal.status}</Badge>
      </div>
      <p className="mt-1 min-w-0 break-words text-sm text-[var(--muted)]">
        {user?.displayName ?? "Deleted user"} · {user?.email ?? "Account unavailable"}
      </p>
      <p className="mt-1 min-w-0 break-all text-sm text-[var(--muted)]">
        UPI {withdrawal.upiId} · Request {new Date(withdrawal.createdAt).toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Current wallet: {user?.availableCoins ?? "—"} available · {user?.lockedCoins ?? "—"} locked
      </p>

      <section className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
        <h2 className="text-sm font-semibold">Balance at withdrawal request</h2>
        {snapshot ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[var(--muted)]">Balance before</dt>
              <dd>{snapshot.totalBeforeReservation} NV total</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Requested</dt>
              <dd>{snapshot.requestedAmount} NV</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Available / locked before</dt>
              <dd>
                {snapshot.availableBeforeReservation} / {snapshot.lockedBeforeReservation} NV
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Available / locked after reserve</dt>
              <dd>
                {snapshot.availableAfterReservation} / {snapshot.lockedAfterReservation} NV
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Remaining balance after reserve</dt>
              <dd>{snapshot.totalAfterReservation} NV total</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">
            The exact balance snapshot was not captured for this historical request.
          </p>
        )}
      </section>

      <section className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
        <h2 className="text-sm font-semibold">Token activity since the last zero-balance reset</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Includes activity through this request
          {initialHistory.resetAt
            ? ` · reset ${new Date(initialHistory.resetAt).toLocaleString("en-IN")}`
            : ""}
        </p>
        <div className="mt-2 max-h-96 overflow-y-auto pr-1 text-xs">
          {transactions.length === 0 ? (
            <p className="text-[var(--muted)]">No permanent token audit entries found.</p>
          ) : (
            <div className="grid gap-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="min-w-0 break-words font-medium">{transaction.label}</span>
                  <span className={transaction.amount >= 0 ? "text-[var(--accent-2)]" : "text-white/75"}>
                    Amount {signed(transaction.amount)} NV
                  </span>
                  <span className="text-[var(--muted)]">
                    {new Date(transaction.createdAt).toLocaleString("en-IN")}
                  </span>
                  <span className="text-right text-[var(--muted)]">
                    Δ available {signed(transaction.availableDelta)} · locked{" "}
                    {signed(transaction.lockedDelta)}
                  </span>
                  <span className="col-span-2 text-[var(--muted)]">
                    Balance {transaction.availableBefore} available / {transaction.lockedBefore} locked
                    {" → "}
                    {transaction.availableAfter} available / {transaction.lockedAfter} locked
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {cursor ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={fetchMore}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load earlier activity"}
          </Button>
        ) : null}
        {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
      </section>

      <section className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
        <h2 className="text-sm font-semibold">Previous withdrawal requests</h2>
        {initialHistory.previousWithdrawals.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">No withdrawal requests found.</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-xs">
            {initialHistory.previousWithdrawals.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/5 pb-2 last:border-0"
              >
                <span>
                  {item.current ? "This request" : "Request"} · {item.amount} NV ·{" "}
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </span>
                <Badge>{item.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={reviewWithdrawalAction} className="mt-3 grid min-w-0 gap-2">
        <input type="hidden" name="withdrawalId" value={withdrawal.id} />
        <Input name="note" placeholder="Admin note (optional)" className="min-w-0 max-w-full" />
        <div className="flex min-w-0 flex-wrap gap-2">
          <PendingSubmitButton name="action" value="approve" size="sm" pendingLabel="Processing...">
            Approve
          </PendingSubmitButton>
          <PendingSubmitButton
            name="action"
            value="paid"
            size="sm"
            variant="secondary"
            pendingLabel="Processing..."
          >
            Mark paid
          </PendingSubmitButton>
          <PendingSubmitButton
            name="action"
            value="reject"
            size="sm"
            variant="danger"
            pendingLabel="Processing..."
          >
            Reject &amp; refund
          </PendingSubmitButton>
        </div>
      </form>
    </Card>
  );
}

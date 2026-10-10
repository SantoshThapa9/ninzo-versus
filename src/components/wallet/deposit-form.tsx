"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDepositAction } from "@/app/actions/wallet";

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: "_modal";
      }) => Promise<{ error?: { message?: string } } | undefined>;
    };
  }
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Cashfree checkout."));
    document.body.appendChild(script);
  });
}

export function DepositForm({
  minCoins,
  coinsPerRupee,
  feePercent,
}: {
  minCoins: number;
  coinsPerRupee: number;
  feePercent: number;
}) {
  const [coins, setCoins] = useState(minCoins);
  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const rupees = coins / coinsPerRupee;
  const fee = (rupees * feePercent) / 100;
  const total = rupees + fee;

  async function pay() {
    try {
      setError("");
      setIsPaying(true);
      await loadScript();
      const order = await createDepositAction(coins);
      const cashfree = window.Cashfree?.({ mode: order.mode });
      if (!cashfree) throw new Error("Cashfree checkout could not be initialized.");
      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_modal",
      });
      if (result?.error) {
        throw new Error(result.error.message || "Cashfree checkout was not completed.");
      }
      const response = await fetch("/api/payments/cashfree/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      const verification = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(verification.error || "Payment could not be confirmed yet.");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NV Token deposit could not be completed");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor="coins">NV Tokens</Label>
        <Input
          id="coins"
          type="number"
          min={minCoins}
          step="0.01"
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
        />
      </div>
      <p className="text-sm text-[var(--muted)]">
        {feePercent > 0
          ? `${coins} NV Tokens. Processing fee ${feePercent}% (₹${fee.toFixed(2)}). Total ₹${total.toFixed(2)}.`
          : `${coins} NV Tokens. Total ₹${rupees.toFixed(2)}.`}
      </p>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <Button type="button" size="full" onClick={pay} disabled={isPaying}>
        {isPaying ? "Opening secure checkout..." : "Get More Tokens"}
      </Button>
    </div>
  );
}

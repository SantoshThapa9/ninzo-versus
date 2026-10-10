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
    script.onerror = () =>
      reject(new Error("Could not load Cashfree checkout."));
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
      if ("error" in order) {
        setError(order.error);
        return;
      }
      const cashfree = window.Cashfree?.({ mode: order.mode });
      if (!cashfree) {
        setError(
          "Secure checkout is unavailable right now. Please try again later.",
        );
        return;
      }
      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_modal",
      });
      if (result?.error) {
        setError("Payment was not completed. No tokens were added.");
        return;
      }
      const response = await fetch("/api/payments/cashfree/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      if (!response.ok) {
        setError(
          response.status === 409
            ? "Your payment is still being confirmed. If you were charged, your tokens will appear shortly."
            : "We couldn't confirm your payment. If you were charged, please check your balance before trying again.",
        );
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error("NV Token deposit checkout failed.", err);
      setError(
        "We couldn't complete the token deposit. Please try again. If you were charged, check your balance before paying again.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor="coins">Minimum {minCoins} NV Tokens</Label>
        <Input
          id="coins"
          type="number"
          min={minCoins}
          step="0.01"
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <Button type="button" size="full" onClick={pay} disabled={isPaying}>
        {isPaying ? "Opening secure checkout..." : "Get More Tokens"}
      </Button>
    </div>
  );
}

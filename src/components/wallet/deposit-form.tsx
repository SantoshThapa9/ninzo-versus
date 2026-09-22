"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDepositAction } from "@/app/actions/wallet";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(script);
  });
}

export function DepositForm({ minCoins, coinsPerRupee, feePercent }: {
  minCoins: number;
  coinsPerRupee: number;
  feePercent: number;
}) {
  const [coins, setCoins] = useState(minCoins);
  const [error, setError] = useState("");
  const rupees = coins / coinsPerRupee;
  const fee = (rupees * feePercent) / 100;
  const total = rupees + fee;

  async function pay() {
    try {
      setError("");
      await loadScript();
      const order = await createDepositAction(coins);
      const razorpay = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: "INR",
        order_id: order.orderId,
        name: "Ninzo Versus",
        description: `${order.coins} NV Coins`,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          window.location.reload();
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor="coins">NV Coins</Label>
        <Input
          id="coins"
          type="number"
          min={minCoins}
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
        />
      </div>
      <p className="text-sm text-[var(--muted)]">
        {feePercent > 0
          ? `You receive ${coins} NV Coins. Processing fee ${feePercent}% (₹${fee.toFixed(2)}). Pay ₹${total.toFixed(2)}.`
          : `You receive ${coins} NV Coins. No deposit fee. Pay ₹${rupees.toFixed(2)}.`}
      </p>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <Button type="button" size="full" onClick={pay}>
        Pay with Razorpay
      </Button>
    </div>
  );
}

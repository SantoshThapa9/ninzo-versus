import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { userRepository } from "@/repositories/user.repository";
import { ledgerRepository } from "@/repositories/finance.repository";
import { getPlatformSettings } from "@/services/settings.service";
import { listWithdrawals } from "@/services/withdrawal.service";
import { DepositForm } from "@/components/wallet/deposit-form";
import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { withdrawAction } from "@/app/actions/wallet";
import { formatTokenActivity } from "@/lib/token-activity";
import { getDailyFreeRewardStatus } from "@/services/wallet.service";
import { DailyFreeReward } from "@/components/wallet/daily-free-reward";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InventoryPage() {
  const session = await auth();
  await connectDb();
  const userId = session?.user?.id;
  const [user, settings, ledger, withdrawals, dailyReward] = userId
    ? await Promise.all([
        userRepository.findById(userId),
        getPlatformSettings(),
        ledgerRepository.listForUser(userId),
        listWithdrawals(userId),
        getDailyFreeRewardStatus(userId),
      ])
    : [null, await getPlatformSettings(), [], [], null];
  const nextRewardDay = new Date();
  nextRewardDay.setUTCDate(nextRewardDay.getUTCDate() + 1);
  const nextRewardLabel = nextRewardDay.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="grid gap-4" aria-labelledby="inventory-heading">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">
          Player inventory
        </p>
        <h1 id="inventory-heading" className="mt-1 text-2xl font-bold">
          NV Token Inventory
        </h1>
      </header>
      <Card data-tour="token-balance">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">
          Available NV Tokens
        </p>
        <p className="text-4xl font-extrabold">{user?.availableCoins ?? 0}</p>
        <p className="text-sm text-[var(--muted)]">
          Reserved for match registration: {user?.lockedCoins ?? 0} NV Tokens
        </p>
      </Card>
      <Card data-tour="buy-tokens">
        <h2 className="mb-1 font-bold">Buy Match Tokens</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Purchasing NV Tokens for Match Entry through Razorpay.
        </p>
        {userId ? <DepositForm
          minCoins={settings.minDepositCoins}
          coinsPerRupee={settings.nvCoinsPerRupee}
          feePercent={settings.depositFeePercent}
        /> : <Button asChild size="full"><Link href="/login?callbackUrl=/inventory">Sign in to buy tokens</Link></Button>}
      </Card>
      <DailyFreeReward
        signedIn={Boolean(userId)}
        claimed={dailyReward?.claimed ?? false}
        rewardDay={dailyReward?.rewardDay ?? 1}
        streak={dailyReward?.streak ?? 0}
        reset={dailyReward?.reset ?? false}
        cycleComplete={dailyReward?.cycleComplete ?? false}
        nextAvailableLabel={nextRewardLabel}
      />
      <Card>
        <h2 className="mb-1 font-bold">Redeem Esports Reward</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Eligible rewards are verified against official tournament results and
          fulfilled by the organizer.
        </p>
        {userId ? <ActionForm action={withdrawAction} submitLabel="Claim Rewards">
          <div>
            <Label htmlFor="coins">NV Tokens to redeem</Label>
            <Input
              id="coins"
              name="coins"
              type="number"
              min={settings.minWithdrawalCoins}
              step="0.01"
              required
            />
          </div>
          <div>
            <Label htmlFor="upiId">UPI ID</Label>
            <Input
              id="upiId"
              name="upiId"
              defaultValue={user?.upiId ?? ""}
              required
            />
          </div>
        </ActionForm> : <Button asChild variant="secondary" size="full"><Link href="/login?callbackUrl=/inventory">Sign in to claim rewards</Link></Button>}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">NV Token activity</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No NV Token activity yet. Join a daily free tournament or register
            for a competitive challenge to get started.
          </p>
        ) : (
          <div className="grid gap-2">
            {ledger.map((row) => (
              <div
                key={String(row._id)}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{formatTokenActivity(row.type)}</span>
                <span className="shrink-0">{row.amount} NV Tokens</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Reward redemption requests</h2>
        {withdrawals.map((row) => (
          <p key={String(row._id)} className="text-sm">
            {row.coins} NV Tokens • {row.status}
          </p>
        ))}
      </Card>
    </section>
  );
}

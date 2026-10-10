import { auth } from "@/auth";
import { connectDb } from "@/lib/db/mongoose";
import { userRepository } from "@/repositories/user.repository";
import { ledgerRepository } from "@/repositories/finance.repository";
import { listWithdrawals } from "@/services/withdrawal.service";
import { DepositForm } from "@/components/wallet/deposit-form";
import { Card } from "@/components/ui/card";
import { formatTokenActivity } from "@/lib/token-activity";
import { getDailyFreeRewardStatus } from "@/services/wallet.service";
import { DailyFreeReward } from "@/components/wallet/daily-free-reward";
import { ECONOMY_DEFAULTS } from "@/config/defaults";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown, Crown, Megaphone } from "lucide-react";
import { DailyAd } from "@/components/wallet/daily-ad";

export default async function InventoryPage() {
  const session = await auth();
  await connectDb();
  const userId = session?.user?.id;
  const [user, ledger, withdrawals, dailyReward] = userId
    ? await Promise.all([
        userRepository.findById(userId),
        ledgerRepository.listForUser(userId),
        listWithdrawals(userId),
        getDailyFreeRewardStatus(userId),
      ])
    : [null, [], [], null];
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
        <h1 id="inventory-heading" className="mt-1 text-2xl font-bold">
          Player inventory
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Complete simple activities and earn NV Tokens for your next match.
        </p>
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
        <h2 className="mb-1 font-bold">Get More Tokens</h2>

        {userId ? (
          !user?.age || user.age < 18 ? (
            <p className="text-sm text-[var(--muted)]">
              Token deposits are available to players aged 18 or older.
            </p>
          ) : !user.phoneNumber ? (
            <p className="text-sm text-[var(--muted)]">
              Add your phone number in your{" "}
              <Link className="underline" href="/profile">
                profile
              </Link>{" "}
              to continue.
            </p>
          ) : (
            <DepositForm
              minCoins={ECONOMY_DEFAULTS.minDepositCoins}
              coinsPerRupee={ECONOMY_DEFAULTS.nvCoinsPerRupee}
              feePercent={ECONOMY_DEFAULTS.depositFeePercent}
            />
          )
        ) : (
          <Button asChild size="full">
            <Link href="/login?callbackUrl=/inventory">
              Sign in to get more tokens
            </Link>
          </Button>
        )}
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
      {/* Watch Ad */}
      <DailyAd />

      <Card className="p-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">
            Redeem NV Tokens
          </p>

          <h2 className="mt-1 text-lg font-bold">Redeem your rewards</h2>

          <p className="mt-1 text-sm text-[var(--muted)]">
            Exchange your NV Tokens for digital rewards, membership benefits,
            and creator promotions.
          </p>
        </div>

        <div className="space-y-2">
          {/* In-App Membership */}
          <details className="group rounded-xl border border-[var(--border)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-2)]/10">
                <Crown size={18} className="text-[var(--accent-2)]" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">In-App Membership</h3>
                <p className="text-xs text-[var(--muted)]">
                  Unlock premium membership benefits.
                </p>
              </div>

              <ChevronDown
                size={17}
                className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-[var(--border)] px-3 pb-3 pt-3">
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Redeem NV Tokens to activate or extend your in-app membership
                and unlock available premium features and benefits.
              </p>

              <button
                type="button"
                disabled
                className="mt-3 flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-300 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Currently Not Available
              </button>
            </div>
          </details>

          {/* Post Promotion */}
          <details className="group rounded-xl border border-[var(--border)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-2)]/10">
                <Megaphone size={18} className="text-[var(--accent-2)]" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Post Promotion</h3>
                <p className="text-xs text-[var(--muted)]">
                  Promote your post to reach more people.
                </p>
              </div>

              <ChevronDown
                size={17}
                className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="border-t border-[var(--border)] px-3 pb-3 pt-3">
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Spend NV Tokens to promote an eligible post and increase its
                visibility across the app.
              </p>

              <button
                type="button"
                disabled
                className="mt-3 flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-300 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                Currently Not Available
              </button>
            </div>
          </details>
        </div>
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

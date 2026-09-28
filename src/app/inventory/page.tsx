import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  const [user, settings, ledger, withdrawals] = await Promise.all([
    userRepository.findById(session.user.id),
    getPlatformSettings(),
    ledgerRepository.listForUser(session.user.id),
    listWithdrawals(session.user.id),
  ]);

  return (
    <section className="grid gap-4" aria-labelledby="inventory-heading">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">Player inventory</p>
        <h1 id="inventory-heading" className="mt-1 text-2xl font-bold">NV Token Inventory</h1>
      </header>
      <Card>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">Available NV Tokens</p>
        <p className="text-4xl font-extrabold">{user?.availableCoins ?? 0}</p>
        <p className="text-sm text-[var(--muted)]">Reserved for match registration: {user?.lockedCoins ?? 0} NV Tokens</p>
      </Card>
      <Card>
        <h2 className="mb-1 font-bold">Buy Match Tokens</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">Purchasing NV Tokens for Match Entry through Razorpay.</p>
        <DepositForm minCoins={settings.minDepositCoins} coinsPerRupee={settings.nvCoinsPerRupee} feePercent={settings.depositFeePercent} />
      </Card>
      <Card>
        <h2 className="mb-1 font-bold">Redeem Esports Reward</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">Eligible rewards are verified against official tournament results and fulfilled by the organizer.</p>
        <ActionForm action={withdrawAction} submitLabel="Request reward redemption">
          <div><Label htmlFor="coins">NV Tokens to redeem</Label><Input id="coins" name="coins" type="number" min={settings.minWithdrawalCoins} required /></div>
          <div><Label htmlFor="upiId">UPI ID</Label><Input id="upiId" name="upiId" defaultValue={user?.upiId ?? ""} required /></div>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">NV Token activity</h2>
        {ledger.length === 0 ? <p className="text-sm text-[var(--muted)]">No NV Token activity yet. Join a daily free tournament or register for a competitive challenge to get started.</p> : <div className="grid gap-2">{ledger.map((row) => <div key={String(row._id)} className="flex items-center justify-between gap-3 text-sm"><span>{formatTokenActivity(row.type)}</span><span className="shrink-0">{row.amount} NV Tokens</span></div>)}</div>}
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Reward redemption requests</h2>
        {withdrawals.map((row) => <p key={String(row._id)} className="text-sm">{row.coins} NV Tokens • {row.status}</p>)}
      </Card>
    </section>
  );
}

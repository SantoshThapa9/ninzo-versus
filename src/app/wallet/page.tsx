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

export default async function WalletPage() {
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
    <div className="grid gap-4">
      <Card>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-2)]">Available</p>
        <p className="text-4xl font-extrabold">{user?.availableCoins ?? 0}</p>
        <p className="text-sm text-[var(--muted)]">Locked {user?.lockedCoins ?? 0} NV</p>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Deposit</h2>
        <DepositForm
          minCoins={settings.minDepositCoins}
          coinsPerRupee={settings.nvCoinsPerRupee}
          feePercent={settings.depositFeePercent}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Withdraw (0% fee, admin payout)</h2>
        <ActionForm action={withdrawAction} submitLabel="Request withdrawal">
          <div>
            <Label htmlFor="coins">NV Coins</Label>
            <Input id="coins" name="coins" type="number" min={settings.minWithdrawalCoins} required />
          </div>
          <div>
            <Label htmlFor="upiId">UPI ID</Label>
            <Input id="upiId" name="upiId" defaultValue={user?.upiId ?? ""} required />
          </div>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Ledger</h2>
        <div className="grid gap-2">
          {ledger.map((row) => (
            <div key={String(row._id)} className="flex justify-between text-sm">
              <span>{row.type}</span>
              <span>{row.amount}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Withdrawals</h2>
        {withdrawals.map((row) => (
          <p key={String(row._id)} className="text-sm">
            {row.coins} NV • {row.status}
          </p>
        ))}
      </Card>
    </div>
  );
}

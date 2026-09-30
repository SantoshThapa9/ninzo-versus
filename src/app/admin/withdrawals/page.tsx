import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { listWithdrawals } from "@/services/withdrawal.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewWithdrawalAction } from "@/app/actions/wallet";

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  const withdrawals = await listWithdrawals();

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Reward fulfillment</h1>
      <p className="text-sm text-[var(--muted)]">Post-match result verification and reward redemption are fulfilled by the organizer.</p>
      {withdrawals.map((row) => (
        <Card key={String(row._id)}>
          <div className="flex items-center justify-between">
            <p className="font-bold">{row.coins} NV Tokens</p>
            <Badge>{row.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">UPI {row.upiId}</p>
          <form action={reviewWithdrawalAction} className="mt-3 grid gap-2">
            <input type="hidden" name="withdrawalId" value={String(row._id)} />
            <Input name="note" placeholder="Admin note" />
            <Input name="utr" placeholder="UTR (private)" />
            <div className="flex gap-2">
              <Button name="action" value="approve" size="sm">
                Approve
              </Button>
              <Button name="action" value="paid" size="sm" variant="secondary">
                Mark paid
              </Button>
              <Button name="action" value="reject" size="sm" variant="danger">
                Reject & refund
              </Button>
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}

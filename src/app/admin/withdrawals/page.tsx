import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { listWithdrawalReviews } from "@/services/withdrawal.service";
import { WithdrawalReviewCard } from "@/components/admin/withdrawal-review-card";

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  const withdrawals = await listWithdrawalReviews();

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-hidden">
      <h1 className="text-2xl font-bold">Reward fulfillment</h1>
      <p className="text-sm text-[var(--muted)]">
        Post-match result verification and reward redemption are fulfilled by
        the organizer.
      </p>
      {withdrawals.map(({ withdrawal, user, flow, nextCursor }) => (
        <WithdrawalReviewCard
          key={String(withdrawal._id)}
          withdrawal={{
            id: String(withdrawal._id),
            coins: withdrawal.coins,
            status: withdrawal.status,
            upiId: withdrawal.upiId,
          }}
          user={user}
          initialTransactions={flow}
          initialCursor={nextCursor}
        />
      ))}
    </div>
  );
}

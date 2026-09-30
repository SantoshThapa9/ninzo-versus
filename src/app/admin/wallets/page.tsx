import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { userRepository } from "@/repositories/user.repository";
import { Card } from "@/components/ui/card";

export default async function AdminWalletsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  await connectDb();
  const users = await userRepository.list({});

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Player inventories</h1>
      {users.map((user) => (
        <Card key={String(user._id)}>
          <p className="font-bold">{user.displayName}</p>
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
          <p className="mt-1 text-sm">
            Available {user.availableCoins} NV Tokens • Reserved {user.lockedCoins} NV Tokens • {user.role}
          </p>
        </Card>
      ))}
    </div>
  );
}

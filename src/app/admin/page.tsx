import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { Card } from "@/components/ui/card";

const links = [
  ["Matches", "/admin/matches"],
  ["Events", "/admin/events"],
  ["New event", "/admin/events/new"],
  ["Withdrawals", "/admin/withdrawals"],
  ["Wallets", "/admin/wallets"],
  ["Support", "/admin/support"],
  ["Results", "/admin/results"],
  ["AI & economy", "/admin/ai"],
  ["Audit", "/admin/audit"],
];

export default async function AdminHome() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Admin</h1>
      {links.map(([label, href]) => (
        <Link key={href} href={href}>
          <Card>{label}</Card>
        </Link>
      ))}
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserRole } from "@/types/enums";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}

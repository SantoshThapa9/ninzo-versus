import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { getAdminActionNotifications } from "@/services/admin-action-notification.service";
import { AdminHomeLinks } from "@/components/admin/admin-home-links";

export default async function AdminHome() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  const initialNotifications = await getAdminActionNotifications();
  return <AdminHomeLinks initialNotifications={initialNotifications} />;
}

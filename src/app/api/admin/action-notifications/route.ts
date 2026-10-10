import { auth } from "@/auth";
import { getAdminActionNotifications } from "@/services/admin-action-notification.service";
import { UserRole } from "@/types/enums";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) {
    return Response.json(
      { error: "Admin access required." },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const notifications = await getAdminActionNotifications();
  return Response.json(notifications, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

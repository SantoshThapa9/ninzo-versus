import { UserRole } from "@/types/enums";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AppError("Please sign in.", "UNAUTHENTICATED", 401);
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== UserRole.ADMIN) {
    throw new AppError("Admin access required.", "FORBIDDEN", 403);
  }
  return session;
}

import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { SupportTicketModel } from "@/models/support-ticket";
import { UserRole } from "@/types/enums";

/** Admin-only, per-ticket permission for customer screenshot uploads. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (session?.user?.role !== UserRole.ADMIN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const payload = (await request.json()) as { enabled?: unknown };
    if (typeof payload.enabled !== "boolean") {
      return Response.json({ error: "Invalid image-upload setting." }, { status: 400 });
    }
    const ticket = await SupportTicketModel.findByIdAndUpdate(
      id,
      { $set: { allowUserImageUploads: payload.enabled } },
      { returnDocument: "after" },
    );
    if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
    return Response.json({ enabled: ticket.allowUserImageUploads });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

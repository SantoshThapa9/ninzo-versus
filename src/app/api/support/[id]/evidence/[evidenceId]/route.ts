import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { connectDb } from "@/lib/db/mongoose";
import { SupportEvidenceModel } from "@/models/support-evidence";
import { supportRepository } from "@/repositories/ops.repository";
import { getPrivateImage } from "@/services/media.service";
import { UserRole } from "@/types/enums";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; evidenceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: ticketId, evidenceId } = await ctx.params;
    await connectDb();
    const ticket = await supportRepository.findTicket(ticketId);
    if (!ticket) throw new AppError("Ticket not found.", "NOT_FOUND", 404);
    if (session.user.role !== UserRole.ADMIN && String(ticket.userId) !== session.user.id) {
      throw new AppError("You cannot view these screenshots.", "FORBIDDEN", 403);
    }

    const evidence = await SupportEvidenceModel.findOne({ _id: evidenceId, ticketId }).lean();
    if (!evidence) throw new AppError("Screenshot not found.", "MEDIA_NOT_FOUND", 404);
    const image = await getPrivateImage(evidence.blobPathname);
    return new Response(image.stream, {
      headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

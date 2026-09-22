import { auth } from "@/auth";
import { AppError, toErrorMessage } from "@/lib/errors";
import { connectDb } from "@/lib/db/mongoose";
import { ResultSubmissionModel } from "@/models/result-submission";
import { matchRepository } from "@/repositories/match.repository";
import { getPrivateImage } from "@/services/media.service";
import { UserRole } from "@/types/enums";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/clash/[id]/evidence/[evidenceId]">,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: matchId, evidenceId } = await ctx.params;
    await connectDb();
    const match = await matchRepository.findById(matchId);
    if (!match) throw new AppError("Match not found.", "MATCH_NOT_FOUND", 404);

    const isParticipant =
      String(match.creatorId) === session.user.id ||
      String(match.opponentCaptainId) === session.user.id;
    if (!isParticipant && session.user.role !== UserRole.ADMIN) {
      throw new AppError("Only match participants can view these screenshots.", "FORBIDDEN", 403);
    }

    const evidence = await ResultSubmissionModel.findOne({ _id: evidenceId, matchId }).lean();
    if (!evidence) throw new AppError("Screenshot not found.", "MEDIA_NOT_FOUND", 404);
    if (session.user.role !== UserRole.ADMIN && String(evidence.userId) !== session.user.id) {
      throw new AppError("You can only view your own screenshot.", "FORBIDDEN", 403);
    }

    const image = await getPrivateImage(evidence.blobPathname);
    return new Response(image.stream, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

import { auth } from "@/auth";
import { uploadPrivateMedia } from "@/services/media.service";
import { submitMatchEvidence } from "@/services/match.service";
import { supportRepository } from "@/repositories/ops.repository";
import { evidenceKindFromForm } from "@/app/actions/match";
import { connectDb } from "@/lib/db/mongoose";
import { rateLimit } from "@/lib/rate-limit";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await rateLimit(`upload:${session.user.id}`, 12, 60);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "File is required." }, { status: 400 });
    }
    const purpose = String(form.get("purpose") ?? "other");
    const folder = purpose === "evidence" ? "matches" : "support";
    const uploaded = await uploadPrivateMedia(file, folder);

    if (purpose === "evidence") {
      const kind = await evidenceKindFromForm(String(form.get("kind") ?? ""));
      await submitMatchEvidence(
        session.user.id,
        String(form.get("matchId") ?? ""),
        kind,
        uploaded.url,
        uploaded.pathname,
      );
    }

    if (purpose === "support") {
      await connectDb();
      await supportRepository.addEvidence({
        ticketId: String(form.get("ticketId") ?? ""),
        userId: session.user.id,
        mediaUrl: uploaded.url,
        blobPathname: uploaded.pathname,
        mimeType: file.type,
        kind: file.type.startsWith("video") ? "video" : "image",
        expiresAt: uploaded.expiresAt,
      });
    }

    return Response.json({ ok: true, url: uploaded.url });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

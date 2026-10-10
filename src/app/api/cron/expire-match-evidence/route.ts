import { AppError, toErrorMessage } from "@/lib/errors";
import { assertCronSecret } from "@/services/media.service";
import { processExpiredMatchEvidenceDeadlines } from "@/services/match.service";

export async function GET(request: Request) {
  try {
    const secret =
      new URL(request.url).searchParams.get("secret") ??
      request.headers.get("authorization");
    assertCronSecret(secret?.replace("Bearer ", "") ?? null);
    return Response.json(await processExpiredMatchEvidenceDeadlines());
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

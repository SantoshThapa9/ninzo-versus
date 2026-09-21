import { assertCronSecret, purgeExpiredMedia } from "@/services/media.service";
import { AppError, toErrorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const secret = new URL(request.url).searchParams.get("secret") ?? request.headers.get("authorization");
    assertCronSecret(secret?.replace("Bearer ", "") ?? null);
    const result = await purgeExpiredMedia();
    return Response.json(result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

import { AppError, toErrorMessage } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { assertCronSecret } from "@/services/media.service";
import { incrementDailyMatchesPlayed } from "@/services/user-stats.service";

export async function GET(request: Request) {
  try {
    // Local development needs an easy way to exercise the same job. Never
    // bypass this check in a production deployment.
    if (process.env.NODE_ENV === "production") {
      const secret =
        new URL(request.url).searchParams.get("secret") ??
        request.headers.get("authorization");
      assertCronSecret(secret?.replace("Bearer ", "") ?? null);
    }
    const result = await incrementDailyMatchesPlayed();
    if (result.executed) {
      revalidatePath("/rank");
      revalidatePath("/profile");
    }
    return Response.json(result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

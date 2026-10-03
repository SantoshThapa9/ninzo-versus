import { AppError, toErrorMessage } from "@/lib/errors";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertCronSecret } from "@/services/media.service";
import { snapshotSeasonRankingsAtMonthEnd } from "@/services/rank.service";

export async function GET(request: Request) {
  try {
    const secret =
      new URL(request.url).searchParams.get("secret") ??
      request.headers.get("authorization");
    assertCronSecret(secret?.replace("Bearer ", "") ?? null);

    const result = await snapshotSeasonRankingsAtMonthEnd();
    if (result.executed) {
      revalidateTag("global-rankings", { expire: 0 });
      revalidateTag("monthly-seasons", { expire: 0 });
      revalidatePath("/rank");
    }
    return Response.json(result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}

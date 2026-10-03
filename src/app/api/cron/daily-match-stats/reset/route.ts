import { resetTodayDailyMatchStatsJobState } from "@/services/user-stats.service";

export async function POST() {
  // This route deliberately does not exist in production. Production keeps
  // its normal scheduled-job and per-user idempotency protection intact.
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json(await resetTodayDailyMatchStatsJobState());
}

import { auth } from "@/auth";
import { listChallengeAcceptancesForCreator } from "@/services/match.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    acceptances: await listChallengeAcceptancesForCreator(session.user.id),
  });
}

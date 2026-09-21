import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { ResultSubmissionModel } from "@/models/result-submission";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminResultsPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  await connectDb();
  const submissions = await ResultSubmissionModel.find().sort({ createdAt: -1 }).limit(50).lean();

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Result verification</h1>
      <p className="text-sm text-[var(--muted)]">
        AI is assistive only. Confirm winners from Clash Squad matches — never auto-pay.
      </p>
      {submissions.map((row) => (
        <Card key={String(row._id)}>
          <div className="flex items-center justify-between">
            <Link href={`/admin/matches`} className="font-bold">
              Match {String(row.matchId)}
            </Link>
            <Badge>{row.kind}</Badge>
          </div>
          {row.aiAnalysis ? (
            <div className="mt-2 text-sm text-[var(--muted)]">
              <p>IGN {row.aiAnalysis.ign ?? "—"}</p>
              <p>Winner guess {row.aiAnalysis.winner ?? "—"}</p>
              <p>Confidence {row.aiAnalysis.confidence ?? "—"}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">No AI analysis.</p>
          )}
        </Card>
      ))}
    </div>
  );
}

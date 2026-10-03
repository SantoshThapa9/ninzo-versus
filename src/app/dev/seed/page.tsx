import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DevSeedForm } from "@/components/dev-seed/dev-seed-form";
import { isLocalDevelopmentRequest } from "@/lib/dev-seed-access";
import { listDevDummyUsers } from "@/services/dev-seed.service";

export default async function DevSeedPage() {
  if (!(await isLocalDevelopmentRequest())) notFound();
  const users = await listDevDummyUsers();

  return (
    <div className="grid gap-5 pb-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Development tools
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Dummy user manager</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add or update dummy user ranking counters in MongoDB. Real users and match records are never modified.
        </p>
      </div>
      <Card className="border-amber-400/20 bg-amber-400/5 text-sm text-amber-100">
        This development-only tool writes directly to the configured MongoDB database.
      </Card>
      <DevSeedForm users={users} />
    </div>
  );
}

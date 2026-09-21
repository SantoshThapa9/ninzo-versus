import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { connectDb } from "@/lib/db/mongoose";
import { auditRepository } from "@/repositories/ops.repository";
import { Card } from "@/components/ui/card";

export default async function AdminAuditPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  await connectDb();
  const logs = await auditRepository.list();

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-bold">Audit log</h1>
      {logs.map((log) => (
        <Card key={String(log._id)}>
          <p className="font-semibold">{log.action}</p>
          <p className="text-sm text-[var(--muted)]">
            {log.entityType} {log.entityId}
          </p>
        </Card>
      ))}
    </div>
  );
}

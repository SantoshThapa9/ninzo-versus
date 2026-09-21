import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { Card } from "@/components/ui/card";
import { EventBuilderForm } from "@/components/admin/event-builder-form";

export default async function NewEventPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/lobby");
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-bold">Event builder</h1>
      <EventBuilderForm />
    </Card>
  );
}

import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createTicketAction } from "@/app/actions/support";
import { ReportType } from "@/types/enums";

export default function NewTicketPage() {
  return (
    <Card>
      <h1 className="mb-3 text-2xl font-bold">Report an issue</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        AI helps first. Share your WhatsApp number, UID, In Game Name, screenshots, and a video when you can.
      </p>
      <ActionForm action={createTicketAction} submitLabel="Start support">
        <div>
          <Label htmlFor="category">Type</Label>
          <select id="category" name="category" className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3">
            {Object.values(ReportType).map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="whatsappNumber">WhatsApp number</Label>
          <Input id="whatsappNumber" name="whatsappNumber" placeholder="+91 98765 43210" required />
        </div>
        <div>
          <Label htmlFor="freeFireUid">Free Fire UID</Label>
          <Input id="freeFireUid" name="freeFireUid" />
        </div>
        <div>
          <Label htmlFor="ign">In Game Name</Label>
          <Input id="ign" name="ign" />
        </div>
        <div>
          <Label htmlFor="summary">What happened</Label>
          <Textarea id="summary" name="summary" required />
        </div>
      </ActionForm>
    </Card>
  );
}

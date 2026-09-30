import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/enums";
import { getPlatformSettings } from "@/services/settings.service";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { PendingSubmitButton } from "@/components/forms/pending-submit-button";
import { saveSettingsAction } from "@/app/actions/wallet";

export default async function AdminAiPage() {
  const session = await auth();
  if (session?.user?.role !== UserRole.ADMIN) redirect("/");
  const settings = await getPlatformSettings();

  return (
    <Card>
      <h1 className="mb-4 text-2xl font-bold">AI & economy</h1>
      <form action={saveSettingsAction} className="grid gap-3">
        <div>
          <Label htmlFor="platformFeePercent">Clash platform fee %</Label>
          <Input
            id="platformFeePercent"
            name="platformFeePercent"
            type="number"
            step="0.01"
            defaultValue={settings.platformFeePercent}
          />
        </div>
        <div>
          <Label htmlFor="depositFeePercent">NV Token purchase processing fee %</Label>
          <Input
            id="depositFeePercent"
            name="depositFeePercent"
            type="number"
            step="0.01"
            defaultValue={settings.depositFeePercent}
          />
        </div>
        <div>
          <Label htmlFor="minDepositCoins">Minimum NV Token purchase</Label>
          <Input id="minDepositCoins" name="minDepositCoins" type="number" step="0.01" defaultValue={settings.minDepositCoins} />
        </div>
        <div>
          <Label htmlFor="minWithdrawalCoins">Minimum reward redemption (NV Tokens)</Label>
          <Input
            id="minWithdrawalCoins"
            name="minWithdrawalCoins"
            type="number"
            step="0.01"
            defaultValue={settings.minWithdrawalCoins}
          />
        </div>
        <div>
          <Label htmlFor="visionModel">Vision model</Label>
          <Input id="visionModel" name="visionModel" defaultValue={settings.visionModel} />
        </div>
        <div>
          <Label htmlFor="chatModel">Support chat model</Label>
          <Input id="chatModel" name="chatModel" defaultValue={settings.chatModel} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visionEnabled" defaultChecked={settings.visionEnabled} />
          Vision enabled (never auto-settles)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="supportAiEnabled" defaultChecked={settings.supportAiEnabled} />
          Support AI enabled
        </label>
        <div>
          <Label htmlFor="clashWarning">Clash warning</Label>
          <Textarea id="clashWarning" name="clashWarning" defaultValue={settings.clashWarning} />
        </div>
        <PendingSubmitButton type="submit" pendingLabel="Saving configuration...">Save configuration</PendingSubmitButton>
      </form>
    </Card>
  );
}

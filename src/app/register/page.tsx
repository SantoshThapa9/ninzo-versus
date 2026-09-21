import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/app/actions/auth";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <Card className="mt-8">
      <h1 className="mb-4 text-2xl font-bold">Join Ninzo Versus</h1>
      <ActionForm action={registerAction} submitLabel="Create account">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
      </ActionForm>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already playing? <Link href="/login">Sign in</Link>
      </p>
    </Card>
  );
}

import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, registerAction } from "@/app/actions/auth";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Card className="mt-8">
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      <ActionForm action={loginAction} submitLabel="Enter lobby">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
      </ActionForm>
      <p className="mt-4 text-sm text-[var(--muted)]">
        New here? <Link href="/register">Create an account</Link>
      </p>
    </Card>
  );
}

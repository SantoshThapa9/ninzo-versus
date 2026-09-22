import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/app/actions/auth";
import { Card } from "@/components/ui/card";
import GoogleSignInButton from "../../components/auth/google-signin-button";
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

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <GoogleSignInButton label="Sign up with Google" />

      <p className="mt-4 text-sm text-[var(--muted)]">
        Already playing? <Link href="/login">Sign in</Link>
      </p>
    </Card>
  );
}

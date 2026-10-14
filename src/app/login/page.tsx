import { ActionForm } from "@/components/forms/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/actions/auth";
import { Card } from "@/components/ui/card";
import GoogleSignInButton from "../../components/auth/google-signin-button";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const googleSignInFailed = params.error === "GoogleSignInFailed";

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

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <GoogleSignInButton
        label="Continue with Google"
        initialError={googleSignInFailed}
      />

      <p className="mt-4 text-sm text-[var(--muted)]">
        New here? <Link href="/register">Create an account</Link>
      </p>
    </Card>
  );
}

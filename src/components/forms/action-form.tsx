"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { error?: string; ok?: boolean; id?: string } | null;

type Action = (prev: State, formData: FormData) => Promise<State>;

export function ActionForm({
  action,
  children,
  submitLabel,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3">
      {children}
      {state?.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-[var(--accent-2)]">Saved.</p> : null}
      <Button type="submit" size="full" disabled={pending}>
        {pending ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}

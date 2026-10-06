"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { error?: string; ok?: boolean; id?: string; message?: string } | null;

type Action = (prev: State, formData: FormData) => Promise<State>;

export function ActionForm({
  action,
  children,
  submitLabel,
  confirmMessage,
  disabled = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel: string;
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="grid gap-3"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
      {state?.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-[var(--accent-2)]">{state.message ?? "Saved."}</p> : null}
      <Button type="submit" size="full" disabled={pending || disabled}>
        {pending ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}

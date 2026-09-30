"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

/** A consistent submit control for admin forms that call Server Actions directly. */
export function PendingSubmitButton({
  children,
  disabled,
  pendingLabel = "Processing...",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

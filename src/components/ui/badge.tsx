import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-2)]",
        className,
      )}
      {...props}
    />
  );
}

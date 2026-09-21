import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-white/8 bg-[var(--card)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)]", className)}
      {...props}
    />
  );
}

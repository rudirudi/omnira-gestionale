import { cn, initials } from "@/lib/utils";

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

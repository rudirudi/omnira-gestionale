import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function AvatarStack({ names, max = 3, className }: { names: string[]; max?: number; className?: string }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  return (
    <span className={cn("flex -space-x-1.5", className)} title={names.join(", ")}>
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} className="size-6 text-[10px] ring-2 ring-card" />
      ))}
      {names.length > max && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

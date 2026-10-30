import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Avanzamento"}
      >
        <div className={cn("h-full rounded-full bg-primary transition-all", pct === 100 && "bg-success")} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground tabular">{pct}%</span>
    </div>
  );
}

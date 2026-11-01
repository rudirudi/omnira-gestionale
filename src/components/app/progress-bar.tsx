import { cn } from "@/lib/utils";

/** Barra di avanzamento: blu in corso, verde a fine lavoro, rossa se ci sono ritardi */
export function ProgressBar({
  value,
  className,
  label,
  late = false,
}: {
  value: number;
  className?: string;
  label?: string;
  late?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Avanzamento"}
      >
        <div
          className={cn("h-full rounded-full bg-work transition-all", pct === 100 && "bg-success", late && pct < 100 && "bg-destructive")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-10 text-right text-xs font-semibold tabular", late && pct < 100 ? "text-destructive" : "text-muted-foreground")}>{pct}%</span>
    </div>
  );
}

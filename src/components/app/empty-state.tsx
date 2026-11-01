import type { LucideIcon } from "lucide-react";
import { AREA, type Area } from "@/lib/areas";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  area = "system",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  area?: Area;
}) {
  const a = AREA[area];
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center", className)}>
      <span className={cn("flex size-12 items-center justify-center rounded-2xl", a.soft, a.text)}>
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

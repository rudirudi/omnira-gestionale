import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

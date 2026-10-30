import { CalendarDays, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { TASK_PRIORITY } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PriorityFlag({ priority, withLabel = false }: { priority: TaskPriority; withLabel?: boolean }) {
  if (priority === "media" && !withLabel) return null;
  const color =
    priority === "urgente" ? "text-destructive" : priority === "alta" ? "text-[oklch(0.75_0.17_85)]" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", color)} title={`Priorità ${TASK_PRIORITY[priority].label.toLowerCase()}`}>
      <Flag className="size-3.5" fill={priority === "urgente" || priority === "alta" ? "currentColor" : "none"} />
      {withLabel && TASK_PRIORITY[priority].label}
    </span>
  );
}

export function dueInfo(due: string | null, status: TaskStatus) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label =
    diff === 0 ? "Oggi" : diff === 1 ? "Domani" : diff === -1 ? "Ieri" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const late = diff < 0 && status !== "fatto";
  return { label, late, soon: diff >= 0 && diff <= 1 && status !== "fatto", diff };
}

export function DueLabel({ due, status }: { due: string | null; status: TaskStatus }) {
  const info = dueInfo(due, status);
  if (!info) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        info.soon && "font-medium text-[oklch(0.62_0.15_75)] dark:text-warning",
        info.late && "font-medium text-destructive",
      )}
    >
      <CalendarDays className="size-3.5" />
      {info.label}
    </span>
  );
}

export function TaskCode({ code, number }: { code?: string | null; number?: number | null }) {
  if (!code || number == null) return null;
  return <span className="shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{code}-{number}</span>;
}

export function SubtaskCount({ total, done }: { total: number; done: number }) {
  if (!total) return null;
  return (
    <Badge tone={done === total ? "success" : "neutral"} className="tabular">
      {done}/{total}
    </Badge>
  );
}

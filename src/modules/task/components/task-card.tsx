import { MessageSquare } from "lucide-react";
import { AvatarStack } from "@/components/app/avatar-stack";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "../queries";
import { DueLabel, PriorityFlag, SubtaskCount, TaskCode } from "./task-meta";

export function TaskCard({ task, showProject, dragging }: { task: TaskListItem; showProject?: boolean; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        task.priority === "urgente" ? "border-l-destructive" : task.priority === "alta" ? "border-l-warning" : task.status === "fatto" ? "border-l-success" : "border-l-work/40",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        <TaskCode code={task.project?.code} number={task.number} />
        <PriorityFlag priority={task.priority} />
        {task.phase && <span className="ml-auto truncate rounded bg-work/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-work-ink">{task.phase.name}</span>}
      </div>
      <p className={cn("mt-1 text-[13px] leading-snug font-medium", task.status === "fatto" && "text-muted-foreground line-through")}>
        {task.title}
      </p>
      {showProject && task.project && <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.project.name}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <DueLabel due={task.due_date} status={task.status} />
        <SubtaskCount total={task.subtasks.total} done={task.subtasks.done} />
        {task.description && <MessageSquare className="size-3 text-muted-foreground/60" aria-label="Ha una descrizione" />}
        <AvatarStack className="ml-auto" names={task.assignees.flatMap((a) => (a.profile ? [a.profile.full_name] : []))} />
      </div>
    </div>
  );
}

import { MessageSquare } from "lucide-react";
import { AvatarStack } from "@/components/app/avatar-stack";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "../queries";
import { DueLabel, PriorityFlag, SubtaskCount, TaskCode } from "./task-meta";

export function TaskCard({ task, showProject, dragging }: { task: TaskListItem; showProject?: boolean; dragging?: boolean }) {
  return (
    <div className={cn("rounded-md border bg-card p-3 shadow-xs transition-shadow hover:shadow-md", dragging && "opacity-40")}>
      <div className="flex items-center gap-2">
        <TaskCode code={task.project?.code} number={task.number} />
        <PriorityFlag priority={task.priority} />
        {task.phase && <span className="ml-auto truncate text-[11px] text-muted-foreground">{task.phase.name}</span>}
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

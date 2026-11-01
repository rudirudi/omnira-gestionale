"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AssigneePicker } from "@/components/app/assignee-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { TASK_PRIORITY, TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CommentThread } from "@/modules/commenti/components/comment-thread";
import {
  deleteTaskAction,
  fetchTaskDetailAction,
  quickAddSubtaskAction,
  setAssigneesAction,
  updateTaskAction,
} from "../actions";
import type { TaskDetail } from "../queries";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskListItem } from "../queries";
import { TaskCode } from "./task-meta";

type Team = { id: string; full_name: string }[];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 py-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TaskSheet({
  taskId,
  team,
  meId,
  isAdmin,
  canDelete,
  onClose,
  preview,
}: {
  preview?: Pick<TaskListItem, "id" | "title" | "number" | "project"> | null;
  taskId: string | null;
  team: Team;
  meId: string;
  isAdmin: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = React.useState<{ id: string; task: TaskDetail | null } | null>(null);
  const [newSub, setNewSub] = React.useState("");
  const [, start] = React.useTransition();

  const load = React.useCallback(() => {
    if (taskId) fetchTaskDetailAction(taskId).then((task) => setLoaded({ id: taskId, task }));
  }, [taskId]);
  React.useEffect(() => {
    load();
  }, [load]);

  const task = loaded?.id === taskId ? loaded.task : undefined;

  const save = (patch: Parameters<typeof updateTaskAction>[1]) =>
    start(async () => {
      const r = await updateTaskAction(task!.id, patch);
      if (!r.ok) toast.error(r.error);
      load();
    });

  return (
    <Dialog open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="flex max-w-2xl flex-col gap-0 overflow-y-auto p-0">
        {task === undefined ? (
          // Apertura immediata con i dati già noti dalla lista; il resto arriva subito dopo
          <div className="flex flex-col" aria-busy="true">
            <div className="border-b p-5 pr-12">
              {preview?.id === taskId ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TaskCode code={preview.project?.code} number={preview.number} />
                    <span>·</span>
                    <span className="truncate">{preview.project?.name}</span>
                  </div>
                  <DialogTitle className="mt-2 px-1 text-lg font-semibold">{preview.title}</DialogTitle>
                </>
              ) : (
                <>
                  <DialogTitle className="sr-only">Caricamento task</DialogTitle>
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="mt-3 h-6 w-3/4" />
                </>
              )}
              <DialogDescription className="sr-only">Caricamento dettagli</DialogDescription>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-44" />
                </div>
              ))}
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carico i dettagli…
              </p>
            </div>
          </div>
        ) : task === null ? (
          <div className="p-6">
            <DialogTitle>Task non trovato</DialogTitle>
            <DialogDescription>Potrebbe essere stato eliminato.</DialogDescription>
          </div>
        ) : (
          <>
            <div className="border-b p-5 pr-12">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TaskCode code={task.project?.code} number={task.number} />
                <span>·</span>
                <Link href={`/progetti/${task.project_id}`} className="truncate hover:text-foreground hover:underline">
                  {task.project?.name}
                </Link>
              </div>
              <DialogTitle className="sr-only">{task.title}</DialogTitle>
              <DialogDescription className="sr-only">Dettaglio del task</DialogDescription>
              <Input
                key={`t-${task.id}-${task.updated_at}`}
                defaultValue={task.title}
                aria-label="Titolo"
                className="mt-1 h-auto border-transparent px-1 py-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-ring"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== task.title) save({ title: v });
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </div>

            <div className="flex flex-col gap-1 border-b px-5 py-4">
              <Row label="Stato">
                <Select value={task.status} onValueChange={(v) => save({ status: v as TaskStatus })}>
                  <SelectTrigger className="h-8 w-44 text-[13px]" aria-label="Stato">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Assegnatari">
                <AssigneePicker
                  team={team}
                  value={task.assignees.map((a) => a.user_id)}
                  onChange={(ids) =>
                    start(async () => {
                      const r = await setAssigneesAction(task.id, ids);
                      if (!r.ok) toast.error(r.error);
                      load();
                    })
                  }
                />
              </Row>
              <Row label="Priorità">
                <Select value={task.priority} onValueChange={(v) => save({ priority: v as TaskPriority })}>
                  <SelectTrigger className="h-8 w-44 text-[13px]" aria-label="Priorità">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY)
                      .sort((a, b) => a[1].rank - b[1].rank)
                      .map(([v, p]) => (
                        <SelectItem key={v} value={v}>
                          {p.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Fase">
                <Select value={task.phase_id ?? "nessuna"} onValueChange={(v) => save({ phase_id: v === "nessuna" ? null : v })}>
                  <SelectTrigger className="h-8 w-44 text-[13px]" aria-label="Fase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nessuna">Nessuna</SelectItem>
                    {task.phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Inizio · scadenza">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Data di inizio"
                    className="h-8 w-40 text-[13px]"
                    defaultValue={task.start_date ?? ""}
                    key={`s-${task.id}-${task.start_date}`}
                    onChange={(e) => save({ start_date: e.target.value || null })}
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="date"
                    aria-label="Scadenza"
                    className="h-8 w-40 text-[13px]"
                    defaultValue={task.due_date ?? ""}
                    key={`d-${task.id}-${task.due_date}`}
                    onChange={(e) => save({ due_date: e.target.value || null })}
                  />
                </div>
              </Row>
              <Row label="Stima (ore)">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  aria-label="Stima in ore"
                  className="h-8 w-28 text-[13px]"
                  defaultValue={task.estimate_hours ?? ""}
                  key={`e-${task.id}-${task.estimate_hours}`}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== task.estimate_hours) save({ estimate_hours: v });
                  }}
                />
              </Row>
            </div>

            <div className="flex flex-col gap-2 border-b px-5 py-4">
              <p className="text-[13px] font-medium">Descrizione</p>
              <Textarea
                key={`desc-${task.id}-${task.updated_at}`}
                defaultValue={task.description ?? ""}
                placeholder="Dettagli, criteri di accettazione, link utili…"
                rows={4}
                aria-label="Descrizione"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== task.description) save({ description: v });
                }}
              />
            </div>

            <div className="flex flex-col gap-2 border-b px-5 py-4">
              <p className="text-[13px] font-medium">
                Sotto-task{" "}
                {task.subtaskList.length > 0 && (
                  <span className="text-muted-foreground tabular">
                    {task.subtaskList.filter((s) => s.status === "fatto").length}/{task.subtaskList.length}
                  </span>
                )}
              </p>
              <ul className="flex flex-col gap-1">
                {task.subtaskList.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={s.status === "fatto"}
                      aria-label={`Completa ${s.title}`}
                      onChange={(e) =>
                        start(async () => {
                          await updateTaskAction(s.id, { status: e.target.checked ? "fatto" : "da_fare" });
                          load();
                        })
                      }
                    />
                    <span className={cn(s.status === "fatto" && "text-muted-foreground line-through")}>{s.title}</span>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = newSub;
                  setNewSub("");
                  start(async () => {
                    const r = await quickAddSubtaskAction(task.id, title);
                    if (!r.ok) toast.error(r.error);
                    load();
                  });
                }}
              >
                <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Aggiungi sotto-task…" className="h-8 text-[13px]" aria-label="Nuovo sotto-task" />
                <Button type="submit" size="sm" variant="outline" disabled={!newSub.trim()}>
                  <Plus /> Aggiungi
                </Button>
              </form>
            </div>

            <div className="flex flex-col gap-3 px-5 py-4">
              <p className="text-[13px] font-medium">Discussione</p>
              <CommentThread entityType="task" entityId={task.id} team={team} meId={meId} isAdmin={isAdmin} />
            </div>

            {canDelete && (
              <div className="mt-auto border-t px-5 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    start(async () => {
                      const r = await deleteTaskAction(task.id);
                      if (r.ok) {
                        toast.success("Task eliminato");
                        onClose();
                      } else toast.error(r.error);
                    })
                  }
                >
                  <Trash2 /> Elimina task
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

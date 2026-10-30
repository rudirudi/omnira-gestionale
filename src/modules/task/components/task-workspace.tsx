"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Columns3, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AvatarStack } from "@/components/app/avatar-stack";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskStatus } from "@/lib/database.types";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { moveTaskAction, updateTaskAction } from "../actions";
import type { TaskListItem } from "../queries";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskCard } from "./task-card";
import { dueInfo, DueLabel, PriorityFlag, TaskCode } from "./task-meta";
import { TaskSheet } from "./task-sheet";

type View = "board" | "lista" | "calendario";
type Team = { id: string; full_name: string }[];

const VIEWS: { value: View; label: string; icon: typeof List }[] = [
  { value: "board", label: "Board", icon: Columns3 },
  { value: "lista", label: "Lista", icon: List },
  { value: "calendario", label: "Calendario", icon: CalendarDays },
];

function newPosition(list: TaskListItem[], beforeId: string | null) {
  if (list.length === 0) return 0;
  if (!beforeId) return list[list.length - 1]!.position + 1;
  const idx = list.findIndex((l) => l.id === beforeId);
  if (idx <= 0) return list[0]!.position - 1;
  return (list[idx - 1]!.position + list[idx]!.position) / 2;
}

export function TaskWorkspace({
  tasks: initial,
  team,
  me,
  basePath,
  projectId,
  phases,
  projects,
  defaultView = "board",
  canDelete,
  isAdmin,
  showProject,
}: {
  tasks: TaskListItem[];
  team: Team;
  me: string;
  basePath: string;
  projectId?: string;
  phases?: { id: string; name: string }[];
  projects?: { id: string; name: string; code: string | null }[];
  defaultView?: View;
  canDelete: boolean;
  isAdmin: boolean;
  showProject?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [tasks, setTasks] = React.useState(initial);
  const [prev, setPrev] = React.useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setTasks(initial);
  }
  const [q, setQ] = React.useState("");
  const [who, setWho] = React.useState<string>("tutti");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<TaskStatus | null>(null);
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const view = (params.get("vista") as View) || defaultView;
  const openId = params.get("aperto");
  const newOpen = params.get("nuovo") === "1";
  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "scheda" && projectId) next.set("scheda", "task");
      router.replace(`${basePath}?${next.toString()}`, { scroll: false });
    },
    [params, router, basePath, projectId],
  );

  const filtered = tasks.filter((t) => {
    if (q && !`${t.title} ${t.project?.code}-${t.number}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (who === "me") return t.assignees.some((a) => a.user_id === me);
    if (who === "nessuno") return t.assignees.length === 0;
    if (who !== "tutti") return t.assignees.some((a) => a.user_id === who);
    return true;
  });

  async function commit(id: string, patch: { status?: TaskStatus; position?: number }) {
    const before = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const r =
      patch.position !== undefined && patch.status
        ? await moveTaskAction(id, patch.status, patch.position)
        : await updateTaskAction(id, patch);
    if (!r.ok) {
      setTasks(before);
      toast.error(r.error);
    }
  }

  function drop(status: TaskStatus, beforeId: string | null) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id || id === beforeId) return;
    const col = filtered.filter((t) => t.status === status && t.id !== id).sort((a, b) => a.position - b.position);
    void commit(id, { status, position: newPosition(col, beforeId) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border bg-card p-0.5" role="tablist" aria-label="Vista">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={view === v.value}
              onClick={() => setParam("vista", v.value)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                view === v.value && "bg-muted text-foreground",
              )}
            >
              <v.icon className="size-3.5" /> {v.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-60">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca task…" className="h-8 pl-8 text-[13px]" aria-label="Cerca task" />
        </div>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="h-8 w-48 text-[13px]" aria-label="Filtra per assegnatario">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="me">Assegnati a me</SelectItem>
            <SelectItem value="nessuno">Non assegnati</SelectItem>
            {team.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" onClick={() => setParam("nuovo", "1")}>
          <Plus /> Nuovo task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nessun task"
          description={projectId ? "Crea il primo task di questo progetto." : "Quando ti assegnano un task, lo trovi qui."}
          action={
            <Button onClick={() => setParam("nuovo", "1")}>
              <Plus /> Nuovo task
            </Button>
          }
        />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          <div className="grid min-w-[1000px] grid-cols-5 gap-3">
            {TASK_STATUSES.map((col) => {
              const items = filtered.filter((t) => t.status === col.value).sort((a, b) => a.position - b.position);
              return (
                <section
                  key={col.value}
                  aria-label={col.label}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOver(col.value);
                  }}
                  onDragLeave={() => setOver((s) => (s === col.value ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(col.value, null);
                  }}
                  className={cn("flex min-h-[55vh] flex-col rounded-lg bg-muted/50 p-2", over === col.value && "bg-primary/8 ring-2 ring-primary/30")}
                >
                  <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
                    <Badge tone={col.tone}>{col.label}</Badge>
                    <span className="text-xs text-muted-foreground tabular">{items.length}</span>
                  </header>
                  <div className="flex flex-col gap-2">
                    {items.map((t) => (
                      <article
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                        onDragOver={(e) => dragId && e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          drop(col.value, t.id);
                        }}
                        onClick={() => setParam("aperto", t.id)}
                        className="cursor-pointer"
                      >
                        <TaskCard task={t} showProject={showProject} dragging={dragId === t.id} />
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : view === "lista" ? (
        <TaskListView tasks={filtered} phases={phases} showProject={showProject} onOpen={(id) => setParam("aperto", id)} onToggle={(t) => commit(t.id, { status: t.status === "fatto" ? "da_fare" : "fatto" })} />
      ) : (
        <TaskCalendar tasks={filtered} month={month} setMonth={setMonth} onOpen={(id) => setParam("aperto", id)} />
      )}

      <NewTaskDialog open={newOpen} onOpenChange={(o) => setParam("nuovo", o ? "1" : null)} projectId={projectId} phases={phases} projects={projects} />
      <TaskSheet taskId={openId} team={team} meId={me} isAdmin={isAdmin} canDelete={canDelete} onClose={() => setParam("aperto", null)} />
    </div>
  );
}

function TaskListView({
  tasks,
  phases,
  showProject,
  onOpen,
  onToggle,
}: {
  tasks: TaskListItem[];
  phases?: { id: string; name: string }[];
  showProject?: boolean;
  onOpen: (id: string) => void;
  onToggle: (t: TaskListItem) => void;
}) {
  const groups: { key: string; label: string; items: TaskListItem[] }[] = [];
  if (phases) {
    for (const p of phases) groups.push({ key: p.id, label: p.name, items: tasks.filter((t) => t.phase_id === p.id) });
    groups.push({ key: "senza", label: "Senza fase", items: tasks.filter((t) => !t.phase_id) });
  } else {
    const open = tasks.filter((t) => t.status !== "fatto");
    const by = (fn: (d: number | null) => boolean) => open.filter((t) => fn(dueInfo(t.due_date, t.status)?.diff ?? null));
    groups.push(
      { key: "scaduti", label: "In ritardo", items: by((d) => d !== null && d < 0) },
      { key: "oggi", label: "Oggi", items: by((d) => d === 0) },
      { key: "settimana", label: "Prossimi 7 giorni", items: by((d) => d !== null && d > 0 && d <= 7) },
      { key: "dopo", label: "Più avanti", items: by((d) => d !== null && d > 7) },
      { key: "senza", label: "Senza scadenza", items: by((d) => d === null) },
      { key: "fatti", label: "Completati", items: tasks.filter((t) => t.status === "fatto").slice(0, 30) },
    );
  }
  const sortTasks = (a: TaskListItem, b: TaskListItem) =>
    Number(a.status === "fatto") - Number(b.status === "fatto") || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

  return (
    <div className="flex flex-col gap-5">
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.key}>
            <h3 className={cn("mb-2 flex items-center gap-2 text-[13px] font-semibold", g.key === "scaduti" && "text-destructive")}>
              {g.label} <span className="font-normal text-muted-foreground tabular">{g.items.length}</span>
            </h3>
            <ul className="divide-y rounded-lg border bg-card">
              {[...g.items].sort(sortTasks).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={t.status === "fatto"}
                    onChange={() => onToggle(t)}
                    className="size-4 shrink-0 accent-[var(--primary)]"
                    aria-label={t.status === "fatto" ? `Riapri ${t.title}` : `Completa ${t.title}`}
                  />
                  <button type="button" onClick={() => onOpen(t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <TaskCode code={t.project?.code} number={t.number} />
                    <span className={cn("truncate text-[13px] font-medium", t.status === "fatto" && "text-muted-foreground line-through")}>
                      {t.title}
                    </span>
                    {showProject && t.project && <span className="hidden truncate text-xs text-muted-foreground md:inline">· {t.project.name}</span>}
                  </button>
                  <PriorityFlag priority={t.priority} />
                  <Badge tone={TASK_STATUS[t.status].tone} className="hidden sm:inline-flex">
                    {TASK_STATUS[t.status].label}
                  </Badge>
                  <span className="hidden w-20 sm:block">
                    <DueLabel due={t.due_date} status={t.status} />
                  </span>
                  <AvatarStack names={t.assignees.flatMap((a) => (a.profile ? [a.profile.full_name] : []))} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function TaskCalendar({
  tasks,
  month,
  setMonth,
  onOpen,
}: {
  tasks: TaskListItem[];
  month: Date;
  setMonth: (d: Date) => void;
  onOpen: (id: string) => void;
}) {
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7; // lunedì = 0
  const start = new Date(first);
  start.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const byDay = new Map<string, TaskListItem[]>();
  for (const t of tasks) if (t.due_date) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);
  const todayKey = key(new Date());
  const noDate = tasks.filter((t) => !t.due_date && t.status !== "fatto").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Mese precedente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Mese successivo" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight />
        </Button>
        <p className="text-[15px] font-semibold capitalize">{month.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</p>
        {noDate > 0 && <span className="ml-auto text-xs text-muted-foreground">{noDate} task aperti senza scadenza (vedi Lista)</span>}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border bg-border gap-px">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="bg-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = key(d);
          const items = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div key={k} className={cn("min-h-28 bg-card p-1.5", !inMonth && "bg-muted/30")}>
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs tabular",
                  !inMonth && "text-muted-foreground/60",
                  k === todayKey && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {d.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {items.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                      t.status === "fatto" ? "bg-success/12 text-muted-foreground line-through" : dueInfo(t.due_date, t.status)?.late ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 3 && <span className="px-1.5 text-[11px] text-muted-foreground">+{items.length - 3} altri</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

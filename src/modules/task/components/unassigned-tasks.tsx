"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, ChevronDown, Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";
import { setAssigneesAction } from "../actions";
import { DueLabel, PriorityFlag, TaskCode } from "./task-meta";

type Item = {
  id: string;
  title: string;
  number: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project: { id: string; code: string | null; name: string } | null;
};

/** Task senza assegnatario: chiunque può prenderlo o assegnarlo a un collega */
export function UnassignedTasks({ tasks, people, meId }: { tasks: Item[]; people: { id: string; full_name: string }[]; meId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [, start] = React.useTransition();
  const others = people.filter((p) => p.id !== meId);

  const assign = (taskId: string, userId: string, label: string) => {
    setBusy(taskId);
    start(async () => {
      const r = await setAssigneesAction(taskId, [userId]);
      if (r.ok) {
        toast.success(label);
        router.refresh();
      } else toast.error(r.error);
      setBusy(null);
    });
  };

  // Raggruppati per progetto, nell'ordine in cui arrivano (scadenza più vicina prima)
  const groups: { key: string; project: Item["project"]; items: Item[] }[] = [];
  for (const t of tasks) {
    const key = t.project?.id ?? "senza";
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(t);
    else groups.push({ key, project: t.project, items: [t] });
  }

  return (
    <div className={cn("grid grid-cols-1 items-start gap-4", groups.length > 1 && "lg:grid-cols-2")}>
      {groups.map((g) => (
        <section key={g.key} className="min-w-0 overflow-hidden rounded-xl border-2 bg-card" style={{ borderColor: projectColor(g.project?.id) }}>
          <header className="relative flex min-h-12 items-center justify-center px-12 py-2.5 text-center text-white" style={{ background: projectColor(g.project?.id) }}>
            <Briefcase className="absolute left-3.5 size-4 opacity-80" aria-hidden />
            <div className="min-w-0">
              {g.project?.code && <p className="font-mono text-[10.5px] leading-none tracking-wider text-white/75">{g.project.code}</p>}
              {g.project ? (
                <Link href={`/progetti/${g.project.id}`} className="block truncate text-[15px] font-bold tracking-tight hover:underline">
                  {g.project.name}
                </Link>
              ) : (
                <p className="text-[15px] font-bold">Senza progetto</p>
              )}
            </div>
            <span className="absolute right-3 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tabular">{g.items.length}</span>
          </header>
          <div className="p-2.5">
          <ul className={cn("grid grid-cols-1 gap-1.5", groups.length === 1 && "lg:grid-cols-2")}>
            {g.items.map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-2 pl-3 hover:bg-muted/40">
                <Link href={`/task?aperto=${t.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    <PriorityFlag priority={t.priority} />
                    {t.title}
                  </p>
                  <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                    <TaskCode code={t.project?.code} number={t.number} />
                    <DueLabel due={t.due_date} status={t.status} />
                  </p>
                </Link>
                {busy === t.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className="flex shrink-0 items-center">
                    <Button size="sm" className="h-7 rounded-r-none px-2.5" aria-label="Prendo io" onClick={() => assign(t.id, meId, "Task preso in carico")}>
                      <Hand /> <span className="hidden sm:inline">Prendo io</span>
                    </Button>
                    {others.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" className="h-7 rounded-l-none border-l border-white/25 px-1.5" aria-label="Assegna a un collega">
                            <ChevronDown />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Assegna a</DropdownMenuLabel>
                          {others.map((p) => (
                            <DropdownMenuItem key={p.id} onSelect={() => assign(t.id, p.id, `Assegnato a ${p.full_name.split(" ")[0]}`)}>
                              {p.full_name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

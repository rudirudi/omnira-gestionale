"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
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

  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 rounded-lg border border-dashed border-work/40 bg-work/[0.03] p-2.5 pl-3">
          <Link href={`/task?aperto=${t.id}`} className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
              <PriorityFlag priority={t.priority} />
              {t.title}
            </p>
            <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
              <TaskCode code={t.project?.code} number={t.number} />
              <span className="truncate">{t.project?.name}</span>
              <DueLabel due={t.due_date} status={t.status} />
            </p>
          </Link>
          {busy === t.id ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex shrink-0 items-center">
              <Button size="sm" className="h-7 rounded-r-none px-2.5" onClick={() => assign(t.id, meId, "Task preso in carico")}>
                <Hand /> Prendo io
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
  );
}

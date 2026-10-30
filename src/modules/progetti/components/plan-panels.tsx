"use client";

import * as React from "react";
import { useActionState, useRef } from "react";
import { CheckCircle2, Circle, Diamond, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-result";
import type { MilestoneRow, PhaseStatus, ProjectPhaseRow } from "@/lib/database.types";
import { ROLE_LABEL } from "@/lib/permissions";
import { cn, formatDate } from "@/lib/utils";
import { addMilestoneAction, deleteMilestoneAction, setMemberAction, toggleMilestoneAction, updatePhaseAction } from "../actions";

const PHASE_STATUS: Record<PhaseStatus, { label: string; tone: "neutral" | "primary" | "success" }> = {
  da_iniziare: { label: "Da iniziare", tone: "neutral" },
  in_corso: { label: "In corso", tone: "primary" },
  completata: { label: "Completata", tone: "success" },
};

export function PhasesPanel({
  projectId,
  phases,
  counts,
  canEdit,
}: {
  projectId: string;
  phases: ProjectPhaseRow[];
  counts: Record<string, { total: number; done: number }>;
  canEdit: boolean;
}) {
  const [, start] = React.useTransition();
  const save = (id: string, patch: { status?: PhaseStatus; start_date?: string | null; due_date?: string | null }) =>
    start(async () => {
      const r = await updatePhaseAction({ id, projectId, ...patch });
      if (!r.ok) toast.error(r.error);
    });

  return (
    <ol className="flex flex-col gap-2">
      {phases.map((p, i) => {
        const c = counts[p.id] ?? { total: 0, done: 0 };
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <span className={cn("flex size-7 items-center justify-center rounded-full border text-xs font-semibold tabular", p.status === "completata" && "border-success bg-success/12 text-success", p.status === "in_corso" && "border-primary bg-primary/10 text-primary")}>
              {i + 1}
            </span>
            <div className="min-w-32 flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground tabular">{c.total ? `${c.done}/${c.total} task completati` : "Nessun task"}</p>
            </div>
            {canEdit ? (
              <>
                <Input type="date" aria-label={`Inizio ${p.name}`} className="h-8 w-36 text-[13px]" defaultValue={p.start_date ?? ""} onChange={(e) => save(p.id, { start_date: e.target.value || null })} />
                <Input type="date" aria-label={`Fine ${p.name}`} className="h-8 w-36 text-[13px]" defaultValue={p.due_date ?? ""} onChange={(e) => save(p.id, { due_date: e.target.value || null })} />
                <Select defaultValue={p.status} onValueChange={(v) => save(p.id, { status: v as PhaseStatus })}>
                  <SelectTrigger className="h-8 w-36 text-[13px]" aria-label={`Stato ${p.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PHASE_STATUS).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground tabular">{p.start_date || p.due_date ? `${formatDate(p.start_date)} → ${formatDate(p.due_date)}` : ""}</span>
                <Badge tone={PHASE_STATUS[p.status].tone}>{PHASE_STATUS[p.status].label}</Badge>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function MilestonesPanel({ projectId, milestones, canEdit }: { projectId: string; milestones: MilestoneRow[]; canEdit: boolean }) {
  const [state, action] = useActionState(addMilestoneAction, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  const [, start] = React.useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      {milestones.length === 0 && <p className="text-[13px] text-muted-foreground">Nessuna milestone. Aggiungi le consegne importanti (es. demo, go-live).</p>}
      <ul className="flex flex-col gap-1.5">
        {milestones.map((m) => {
          const late = !m.done_at && m.due_date < today;
          return (
            <li key={m.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <button
                type="button"
                disabled={!canEdit}
                aria-label={m.done_at ? `Segna ${m.title} come da fare` : `Segna ${m.title} come raggiunta`}
                onClick={() => start(async () => void (await toggleMilestoneAction(m.id, projectId, !m.done_at)))}
              >
                {m.done_at ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
              </button>
              <Diamond className={cn("size-3.5", late ? "text-destructive" : "text-primary")} />
              <span className={cn("flex-1 text-[13px]", m.done_at && "text-muted-foreground line-through")}>{m.title}</span>
              <span className={cn("text-xs tabular", late ? "font-medium text-destructive" : "text-muted-foreground")}>{formatDate(m.due_date)}</span>
              {canEdit && (
                <button type="button" aria-label={`Elimina ${m.title}`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => start(async () => void (await deleteMilestoneAction(m.id, projectId)))}>
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <ActionForm ref={ref} action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="project_id" value={projectId} />
          <Input name="title" placeholder="Nuova milestone (es. Demo al cliente)" className="h-8 flex-1 text-[13px]" aria-label="Titolo milestone" />
          <Input name="due_date" type="date" className="h-8 w-40 text-[13px]" aria-label="Data milestone" />
          <SubmitButton size="sm" variant="outline"><Plus /> Aggiungi</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function MembersPanel({
  projectId,
  members,
  team,
  managerId,
  canEdit,
}: {
  projectId: string;
  members: { id: string; full_name: string; email: string; job_title: string | null; role: keyof typeof ROLE_LABEL }[];
  team: { id: string; full_name: string }[];
  managerId: string | null;
  canEdit: boolean;
}) {
  const [, start] = React.useTransition();
  const [adding, setAdding] = React.useState<string>("");
  const others = team.filter((t) => !members.some((m) => m.id === t.id));
  const set = (userId: string, member: boolean) =>
    start(async () => {
      const r = await setMemberAction(projectId, userId, member);
      if (!r.ok) toast.error(r.error);
    });
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Avatar name={m.full_name} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {m.full_name} {m.id === managerId && <Badge tone="primary" className="ml-1">PM</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.job_title ?? ROLE_LABEL[m.role]}</p>
            </div>
            {canEdit && m.id !== managerId && (
              <Button variant="ghost" size="icon-sm" aria-label={`Rimuovi ${m.full_name}`} onClick={() => set(m.id, false)}>
                <UserMinus className="text-muted-foreground" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && others.length > 0 && (
        <div className="flex gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="h-8 w-60 text-[13px]" aria-label="Aggiungi al team"><SelectValue placeholder="Aggiungi una persona…" /></SelectTrigger>
            <SelectContent>
              {others.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!adding} onClick={() => { set(adding, true); setAdding(""); }}>
            <UserPlus /> Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}

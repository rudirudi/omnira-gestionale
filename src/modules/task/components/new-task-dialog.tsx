"use client";

import * as React from "react";
import { useActionState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-result";
import { TASK_PRIORITY, TASK_STATUSES } from "@/lib/labels";
import { createTaskAction } from "../actions";

export function NewTaskDialog({
  open,
  onOpenChange,
  projects,
  projectId,
  phases,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects?: { id: string; name: string; code: string | null }[];
  projectId?: string;
  phases?: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createTaskAction, initialActionState);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useActionToast(state, close);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo task</DialogTitle>
          <DialogDescription>Dettagli, sotto-task e commenti si aggiungono dopo, aprendo il task.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
          {projectId ? (
            <input type="hidden" name="project_id" value={projectId} />
          ) : (
            <Field label="Progetto *" htmlFor="t_project" error={err("project_id")} className="sm:col-span-2">
              <Select name="project_id">
                <SelectTrigger id="t_project">
                  <SelectValue placeholder="Scegli un progetto…" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code ? `${p.code} · ` : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Titolo *" htmlFor="t_title" error={err("title")} className="sm:col-span-2">
            <Input id="t_title" name="title" placeholder="Es. Integrare pagamenti Stripe" autoFocus />
          </Field>
          {phases && phases.length > 0 && (
            <Field label="Fase" htmlFor="t_phase">
              <Select name="phase_id">
                <SelectTrigger id="t_phase">
                  <SelectValue placeholder="Nessuna" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Stato" htmlFor="t_status">
            <Select name="status" defaultValue="da_fare">
              <SelectTrigger id="t_status">
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
          </Field>
          <Field label="Priorità" htmlFor="t_priority">
            <Select name="priority" defaultValue="media">
              <SelectTrigger id="t_priority">
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
          </Field>
          <Field label="Scadenza" htmlFor="t_due">
            <Input id="t_due" name="due_date" type="date" />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
            <input type="checkbox" name="assign_to_me" defaultChecked className="size-4 accent-[var(--primary)]" />
            Assegnalo a me
          </label>
          <div className="flex justify-end sm:col-span-2">
            <SubmitButton>Crea task</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

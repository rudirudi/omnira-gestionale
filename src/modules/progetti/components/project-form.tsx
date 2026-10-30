"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ActionResult, initialActionState } from "@/lib/action-result";
import type { ProjectRow } from "@/lib/database.types";
import { BILLING_TYPE, PROJECT_STATUS, PROJECT_TYPE } from "@/lib/labels";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function ProjectForm({
  action,
  defaults,
  clients,
  team,
  submitLabel,
  isNew = false,
  readOnly = false,
}: {
  action: Action;
  defaults?: Partial<ProjectRow>;
  clients: { id: string; name: string }[];
  team: { id: string; full_name: string }[];
  submitLabel: string;
  isNew?: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const d = defaults ?? {};
  const euro = d.budget_cents != null ? (d.budget_cents / 100).toLocaleString("it-IT") : "";

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome progetto *" htmlFor="p_name" error={err("name")} className="sm:col-span-2">
          <Input id="p_name" name="name" defaultValue={d.name ?? ""} placeholder="Es. Nuovo e-commerce Bottega Rossi" autoFocus={isNew} />
        </Field>
        <Field label="Cliente" htmlFor="p_client">
          <Select name="client_id" defaultValue={d.client_id ?? undefined} disabled={readOnly}>
            <SelectTrigger id="p_client"><SelectValue placeholder="Progetto interno" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="p_type">
          <Select name="type" defaultValue={d.type ?? "sito"} disabled={readOnly}>
            <SelectTrigger id="p_type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_TYPE).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Stato" htmlFor="p_status">
          <Select name="status" defaultValue={d.status ?? "pianificato"} disabled={readOnly}>
            <SelectTrigger id="p_status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Project manager" htmlFor="p_manager" hint={isNew ? "Se vuoto, sei tu" : undefined}>
          <Select name="manager_id" defaultValue={d.manager_id ?? undefined} disabled={readOnly}>
            <SelectTrigger id="p_manager"><SelectValue placeholder="Scegli…" /></SelectTrigger>
            <SelectContent>
              {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Inizio" htmlFor="p_start">
          <Input id="p_start" name="start_date" type="date" defaultValue={d.start_date ?? ""} />
        </Field>
        <Field label="Consegna prevista" htmlFor="p_due" error={err("due_date")}>
          <Input id="p_due" name="due_date" type="date" defaultValue={d.due_date ?? ""} />
        </Field>
        <Field label="Fatturazione" htmlFor="p_billing">
          <Select name="billing_type" defaultValue={d.billing_type ?? "corpo"} disabled={readOnly}>
            <SelectTrigger id="p_billing"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BILLING_TYPE).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget (€)" htmlFor="p_budget" error={err("budget")}>
            <Input id="p_budget" name="budget" defaultValue={euro} inputMode="decimal" placeholder="Es. 4.500" />
          </Field>
          <Field label="Ore previste" htmlFor="p_hours" error={err("budget_hours")}>
            <Input id="p_hours" name="budget_hours" defaultValue={d.budget_hours ?? ""} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Descrizione" htmlFor="p_desc" className="sm:col-span-2">
          <Textarea id="p_desc" name="description" defaultValue={d.description ?? ""} rows={3} placeholder="Obiettivi, perimetro, note per il team" />
        </Field>
        {isNew && (
          <label className="flex items-start gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" name="use_template" defaultChecked className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              Crea i task tipici per questo tipo di progetto
              <span className="block text-xs text-muted-foreground">Le 5 fasi (Analisi → Rilascio) vengono create sempre.</span>
            </span>
          </label>
        )}
      </fieldset>
      {!readOnly && <div className="flex justify-end"><SubmitButton>{submitLabel}</SubmitButton></div>}
    </ActionForm>
  );
}

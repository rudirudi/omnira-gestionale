"use client";

import * as React from "react";
import { useActionState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ActionResult, initialActionState } from "@/lib/action-result";
import { EXPENSE_CATEGORIES, EXPENSE_PAID_WITH, PAYMENT_METHOD, RENEWAL_FREQUENCY } from "@/lib/labels";
import type { ExpenseCategory, ExpensePaidWith, PaymentMethod, RenewalFrequency } from "@/lib/database.types";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
export type Person = { id: string; full_name: string };
export type ProjectOpt = { id: string; code: string | null; name: string };

export const euroInput = (c?: number | null) =>
  c ? (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
export const todayIso = () => new Date().toISOString().slice(0, 10);

function CategorySelect({ id, defaultValue }: { id: string; defaultValue: ExpenseCategory }) {
  return (
    <Select name="category" defaultValue={defaultValue}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {EXPENSE_CATEGORIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            <span className={`mr-1.5 inline-block size-2 rounded-full ${c.color}`} aria-hidden />
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Chi ha pagato + con cosa + metodo: blocco comune a spese e abbonamenti */
function PayerFields({
  prefix,
  people,
  canChoosePerson,
  defaults,
}: {
  prefix: string;
  people: Person[];
  canChoosePerson: boolean;
  defaults: { paid_by?: string | null; paid_with?: ExpensePaidWith; method?: PaymentMethod };
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-dashed bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-3">
      {canChoosePerson ? (
        <Field label="Chi ha pagato" htmlFor={`${prefix}_by`}>
          <Select name="paid_by" defaultValue={defaults.paid_by ?? undefined}>
            <SelectTrigger id={`${prefix}_by`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="paid_by" value={defaults.paid_by ?? ""} />
      )}
      <Field label="Pagata con" htmlFor={`${prefix}_with`} className={canChoosePerson ? "" : "sm:col-span-2"}>
        <Select name="paid_with" defaultValue={defaults.paid_with ?? "azienda"}>
          <SelectTrigger id={`${prefix}_with`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(EXPENSE_PAID_WITH).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Metodo" htmlFor={`${prefix}_method`}>
        <Select name="method" defaultValue={defaults.method ?? "carta"}>
          <SelectTrigger id={`${prefix}_method`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_METHOD).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export function ExpenseForm({
  action,
  people,
  projects,
  canChoosePerson,
  meId,
  defaults,
  submitLabel,
  onDone,
}: {
  action: Action;
  people: Person[];
  projects: ProjectOpt[];
  canChoosePerson: boolean;
  meId: string;
  defaults?: {
    spent_on?: string;
    description?: string;
    amount_cents?: number;
    category?: ExpenseCategory;
    supplier?: string | null;
    paid_by?: string | null;
    paid_with?: ExpensePaidWith;
    method?: PaymentMethod;
    project_id?: string | null;
    notes?: string | null;
  };
  submitLabel: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Descrizione *" htmlFor="e_desc" error={err("description")} className="sm:col-span-2">
        <Input id="e_desc" name="description" defaultValue={defaults?.description ?? ""} placeholder="Es. Monitor 27'', Pranzo cliente, Corso React" autoFocus />
      </Field>
      <Field label="Importo (€) *" htmlFor="e_amount" error={err("amount")}>
        <Input id="e_amount" name="amount" defaultValue={euroInput(defaults?.amount_cents)} inputMode="decimal" placeholder="Es. 49,90" className="text-base font-semibold tabular" />
      </Field>
      <Field label="Data *" htmlFor="e_date" error={err("spent_on")}>
        <Input id="e_date" name="spent_on" type="date" defaultValue={defaults?.spent_on ?? todayIso()} />
      </Field>
      <Field label="Categoria" htmlFor="e_cat">
        <CategorySelect id="e_cat" defaultValue={defaults?.category ?? "altro"} />
      </Field>
      <Field label="Fornitore" htmlFor="e_supplier">
        <Input id="e_supplier" name="supplier" defaultValue={defaults?.supplier ?? ""} placeholder="Es. Amazon, Aruba, Trenitalia" />
      </Field>
      <PayerFields prefix="e" people={people} canChoosePerson={canChoosePerson} defaults={{ paid_by: defaults?.paid_by ?? meId, paid_with: defaults?.paid_with, method: defaults?.method }} />
      <Field label="Progetto (se è un costo di un progetto)" htmlFor="e_project" className="sm:col-span-2">
        <Select name="project_id" defaultValue={defaults?.project_id ?? undefined}>
          <SelectTrigger id="e_project"><SelectValue placeholder="Nessuno: spesa generale" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Note" htmlFor="e_notes" className="sm:col-span-2">
        <Textarea id="e_notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton className="bg-money hover:bg-money/90">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SubscriptionForm({
  action,
  people,
  canChoosePerson,
  meId,
  defaults,
  lockSchedule,
  submitLabel,
  onDone,
}: {
  action: Action;
  people: Person[];
  canChoosePerson: boolean;
  meId: string;
  defaults?: {
    name?: string;
    supplier?: string | null;
    category?: ExpenseCategory;
    amount_cents?: number;
    frequency?: RenewalFrequency;
    start_date?: string;
    end_date?: string | null;
    paid_by?: string | null;
    paid_with?: ExpensePaidWith;
    method?: PaymentMethod;
    notes?: string | null;
  };
  /** dopo il primo addebito inizio e frequenza non si cambiano più */
  lockSchedule?: boolean;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome *" htmlFor="s_name" error={err("name")}>
        <Input id="s_name" name="name" defaultValue={defaults?.name ?? ""} placeholder="Es. Claude Max, Lovable Pro" autoFocus />
      </Field>
      <Field label="Fornitore" htmlFor="s_supplier">
        <Input id="s_supplier" name="supplier" defaultValue={defaults?.supplier ?? ""} placeholder="Es. Anthropic, Lovable" />
      </Field>
      <Field label="Importo per addebito (€) *" htmlFor="s_amount" error={err("amount")}>
        <Input id="s_amount" name="amount" defaultValue={euroInput(defaults?.amount_cents)} inputMode="decimal" placeholder="Es. 90" className="text-base font-semibold tabular" />
      </Field>
      <Field label="Ogni quanto" htmlFor="s_freq">
        <Select name="frequency" defaultValue={defaults?.frequency ?? "mensile"} disabled={lockSchedule}>
          <SelectTrigger id="s_freq"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RENEWAL_FREQUENCY).map(([v, f]) => <SelectItem key={v} value={v}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Primo addebito *"
        htmlFor="s_start"
        error={err("start_date")}
        hint={lockSchedule ? "Già partito: per cambiarlo disdici e creane uno nuovo" : "Se è iniziato mesi fa metti la data vera: registro anche gli addebiti passati"}
      >
        <Input id="s_start" name="start_date" type="date" defaultValue={defaults?.start_date ?? todayIso()} disabled={lockSchedule} />
      </Field>
      <Field label="Termina il (facoltativo)" htmlFor="s_end" error={err("end_date")} hint="Vuoto = continua finché non lo disdici">
        <Input id="s_end" name="end_date" type="date" defaultValue={defaults?.end_date ?? ""} />
      </Field>
      <Field label="Categoria" htmlFor="s_cat" className="sm:col-span-2">
        <CategorySelect id="s_cat" defaultValue={defaults?.category ?? "software"} />
      </Field>
      <PayerFields prefix="s" people={people} canChoosePerson={canChoosePerson} defaults={{ paid_by: defaults?.paid_by ?? meId, paid_with: defaults?.paid_with, method: defaults?.method }} />
      <Field label="Note" htmlFor="s_notes" className="sm:col-span-2">
        <Textarea id="s_notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} placeholder="Es. account usato, piano, chi lo usa" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton className="bg-money hover:bg-money/90">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

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
import { PAYMENT_METHOD } from "@/lib/labels";
import { addPaymentAction } from "../actions";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
const euro = (c?: number | null) => (c ? (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const today = () => new Date().toISOString().slice(0, 10);

export function ReceivableForm({
  action,
  clients,
  projects,
  defaults,
  submitLabel,
  isNew,
  onDone,
}: {
  action: Action;
  clients: { id: string; name: string }[];
  projects: { id: string; code: string | null; name: string; client_id: string | null }[];
  defaults?: { client_id?: string; project_id?: string | null; description?: string; amount_cents?: number; due_date?: string | null; notes?: string | null };
  submitLabel: string;
  isNew?: boolean;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const [clientId, setClientId] = React.useState(defaults?.client_id ?? "");
  const projectOptions = projects.filter((p) => !clientId || p.client_id === clientId);

  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Cliente *" htmlFor="r_client" error={err("client_id")}>
        <Select name="client_id" value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="r_client"><SelectValue placeholder="Scegli…" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Progetto" htmlFor="r_project">
        <Select name="project_id" defaultValue={defaults?.project_id ?? undefined}>
          <SelectTrigger id="r_project"><SelectValue placeholder="Nessuno" /></SelectTrigger>
          <SelectContent>
            {projectOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Descrizione *" htmlFor="r_desc" error={err("description")} className="sm:col-span-2">
        <Input id="r_desc" name="description" defaultValue={defaults?.description ?? ""} placeholder="Es. Sito vetrina – saldo, Acconto 30%" />
      </Field>
      <Field label="Importo (€) *" htmlFor="r_amount" error={err("amount")}>
        <Input id="r_amount" name="amount" defaultValue={euro(defaults?.amount_cents)} inputMode="decimal" placeholder="Es. 800" className="text-base font-semibold tabular" />
      </Field>
      <Field label="Da pagare entro" htmlFor="r_due">
        <Input id="r_due" name="due_date" type="date" defaultValue={defaults?.due_date ?? ""} />
      </Field>
      {isNew && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-money/40 bg-money/[0.04] p-3 sm:col-span-2">
          <p className="col-span-2 text-xs font-medium text-money-ink">Il cliente ha già pagato qualcosa? (facoltativo)</p>
          <Field label="Già pagato (€)" htmlFor="r_paid" error={err("paid_now")}>
            <Input id="r_paid" name="paid_now" inputMode="decimal" placeholder="Es. 300" />
          </Field>
          <Field label="Metodo" htmlFor="r_paid_m">
            <Select name="paid_method" defaultValue="bonifico">
              <SelectTrigger id="r_paid_m"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
      <Field label="Note" htmlFor="r_notes" className="sm:col-span-2">
        <Textarea id="r_notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PaymentForm({ receivableId, remainingCents, onDone }: { receivableId: string; remainingCents: number; onDone?: () => void }) {
  const [state, action] = useActionState(addPaymentAction, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <ActionForm action={action} className="grid gap-3 rounded-xl border border-money/30 bg-money/[0.05] p-4 sm:grid-cols-2">
      <input type="hidden" name="receivable_id" value={receivableId} />
      <p className="text-[13px] font-semibold text-money-ink sm:col-span-2">Registra un pagamento ricevuto</p>
      <Field label="Importo (€)" htmlFor="p_amount" error={err("amount")} hint="Proposto: tutto il residuo">
        <Input id="p_amount" name="amount" defaultValue={euro(remainingCents)} inputMode="decimal" className="text-base font-semibold tabular" />
      </Field>
      <Field label="Data" htmlFor="p_date" error={err("paid_on")}>
        <Input id="p_date" name="paid_on" type="date" defaultValue={today()} />
      </Field>
      <Field label="Metodo" htmlFor="p_method">
        <Select name="method" defaultValue="bonifico">
          <SelectTrigger id="p_method"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_METHOD).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nota" htmlFor="p_note">
        <Input id="p_note" name="note" placeholder="Es. CRO bonifico, acconto" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton className="bg-money hover:bg-money/90">Registra pagamento</SubmitButton>
      </div>
    </ActionForm>
  );
}

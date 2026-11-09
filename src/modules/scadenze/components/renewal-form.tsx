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
import type { RenewalRow } from "@/lib/database.types";
import { RENEWAL_FREQUENCY, RENEWAL_TYPE } from "@/lib/labels";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
const euro = (c?: number | null) => (c != null ? (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

export function RenewalForm({
  action,
  clients,
  projects,
  defaults,
  submitLabel,
  onDone,
}: {
  action: Action;
  clients: { id: string; name: string }[];
  projects: { id: string; code: string | null; name: string; client_id: string | null }[];
  defaults?: Partial<RenewalRow>;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const d = defaults ?? {};
  const [clientId, setClientId] = React.useState(d.client_id ?? "");

  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Tipo" htmlFor="rn_type">
        <Select name="type" defaultValue={d.type ?? "dominio"}>
          <SelectTrigger id="rn_type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RENEWAL_TYPE).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nome *" htmlFor="rn_name" error={err("name")}>
        <Input id="rn_name" name="name" defaultValue={d.name ?? ""} placeholder="Es. bottegarossi.it, VPS gestionale" />
      </Field>
      <Field label="Cliente" htmlFor="rn_client" hint="Vuoto = servizio interno Omnira">
        <Select name="client_id" value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="rn_client"><SelectValue placeholder="Interno Omnira" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Progetto" htmlFor="rn_project">
        <Select name="project_id" defaultValue={d.project_id ?? undefined}>
          <SelectTrigger id="rn_project"><SelectValue placeholder="Nessuno" /></SelectTrigger>
          <SelectContent>
            {projects.filter((p) => !clientId || p.client_id === clientId).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fornitore" htmlFor="rn_provider">
        <Input id="rn_provider" name="provider" defaultValue={d.provider ?? ""} placeholder="Es. Aruba, Hetzner, AWS, Register.it" />
      </Field>
      <Field label="Ogni quanto si paga" htmlFor="rn_freq">
        <Select name="frequency" defaultValue={d.frequency ?? "annuale"}>
          <SelectTrigger id="rn_freq"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RENEWAL_FREQUENCY).map(([v, f]) => <SelectItem key={v} value={v}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Prossima scadenza *" htmlFor="rn_due" error={err("next_due_date")}>
        <Input id="rn_due" name="next_due_date" type="date" defaultValue={d.next_due_date ?? ""} />
      </Field>
      <Field label="Avvisami (giorni prima)" htmlFor="rn_notify" error={err("notify_days_before")}>
        <Input id="rn_notify" name="notify_days_before" type="number" min={1} max={365} defaultValue={d.notify_days_before ?? 30} />
      </Field>
      <Field label="Costo per noi (€)" htmlFor="rn_cost" error={err("cost")} hint="Quanto paghiamo al fornitore">
        <Input id="rn_cost" name="cost" defaultValue={euro(d.cost_cents)} inputMode="decimal" placeholder="Es. 9,90" />
      </Field>
      <Field label="Prezzo al cliente (€)" htmlFor="rn_price" error={err("price")} hint="Usato per l'importo da incassare al rinnovo">
        <Input id="rn_price" name="price" defaultValue={euro(d.price_cents)} inputMode="decimal" placeholder="Es. 25" />
      </Field>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input type="checkbox" name="auto_renew" defaultChecked={d.auto_renew ?? false} className="size-4 accent-[var(--primary)]" />
        Rinnovo automatico: alla scadenza crea da solo l&apos;incasso (e la spesa) e passa al periodo successivo
      </label>
      <Field label="Note" htmlFor="rn_notes" className="sm:col-span-2">
        <Textarea id="rn_notes" name="notes" rows={2} defaultValue={d.notes ?? ""} placeholder="Es. account Aruba di riferimento, DNS gestiti da noi" />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

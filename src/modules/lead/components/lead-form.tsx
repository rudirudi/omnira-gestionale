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
import type { LeadRow } from "@/lib/database.types";
import { LEAD_SOURCE, SERVICES } from "@/lib/labels";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function LeadForm({
  action,
  defaults,
  team,
  submitLabel,
  onDone,
  readOnly = false,
}: {
  action: Action;
  defaults?: Partial<LeadRow>;
  team: { id: string; full_name: string }[];
  submitLabel: string;
  onDone?: () => void;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const d = defaults ?? {};
  const euro = d.estimated_value_cents != null ? (d.estimated_value_cents / 100).toLocaleString("it-IT") : "";

  return (
    <ActionForm action={formAction} className="flex flex-col gap-5">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Titolo *" htmlFor="l_title" error={err("title")} className="sm:col-span-2">
          <Input id="l_title" name="title" defaultValue={d.title ?? ""} placeholder="Es. Nuovo e-commerce Bottega Rossi" required />
        </Field>
        <Field label="Azienda" htmlFor="l_company">
          <Input id="l_company" name="company_name" defaultValue={d.company_name ?? ""} />
        </Field>
        <Field label="Persona di contatto" htmlFor="l_contact">
          <Input id="l_contact" name="contact_name" defaultValue={d.contact_name ?? ""} />
        </Field>
        <Field label="Email" htmlFor="l_email" error={err("email")}>
          <Input id="l_email" name="email" type="email" defaultValue={d.email ?? ""} />
        </Field>
        <Field label="Telefono" htmlFor="l_phone">
          <Input id="l_phone" name="phone" type="tel" defaultValue={d.phone ?? ""} />
        </Field>
        <Field label="Servizio di interesse" htmlFor="l_service">
          <Select name="service_interest" defaultValue={d.service_interest ?? undefined} disabled={readOnly}>
            <SelectTrigger id="l_service">
              <SelectValue placeholder="Scegli…" />
            </SelectTrigger>
            <SelectContent>
              {SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Provenienza" htmlFor="l_source">
          <Select name="source" defaultValue={d.source ?? "sito"} disabled={readOnly}>
            <SelectTrigger id="l_source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_SOURCE).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Valore stimato (€)" htmlFor="l_value" error={err("estimated_value")}>
          <Input id="l_value" name="estimated_value" defaultValue={euro} inputMode="decimal" placeholder="Es. 1.999" />
        </Field>
        <Field label="Chiusura prevista" htmlFor="l_close">
          <Input id="l_close" name="expected_close_date" type="date" defaultValue={d.expected_close_date ?? ""} />
        </Field>
        <Field label="Responsabile" htmlFor="l_owner" className="sm:col-span-2">
          <Select name="owner_id" defaultValue={d.owner_id ?? undefined} disabled={readOnly}>
            <SelectTrigger id="l_owner">
              <SelectValue placeholder="Nessuno" />
            </SelectTrigger>
            <SelectContent>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Note" htmlFor="l_notes" className="sm:col-span-2">
          <Textarea id="l_notes" name="notes" defaultValue={d.notes ?? ""} rows={3} />
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

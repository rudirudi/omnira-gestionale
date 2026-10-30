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
import type { ClientRow } from "@/lib/database.types";
import { CLIENT_STATUS } from "@/lib/labels";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function ClientForm({
  action,
  defaults,
  team,
  submitLabel,
  readOnly = false,
  compact = false,
}: {
  action: Action;
  defaults?: Partial<ClientRow>;
  team: { id: string; full_name: string }[];
  submitLabel: string;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const d = defaults ?? {};

  return (
    <ActionForm action={formAction} className="flex flex-col gap-6">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome cliente *" htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={d.name ?? ""} placeholder="Es. Templana" autoFocus={compact} required />
        </Field>
        <Field label="Ragione sociale" htmlFor="legal_name" error={err("legal_name")}>
          <Input id="legal_name" name="legal_name" defaultValue={d.legal_name ?? ""} placeholder="Es. Templana S.r.l." />
        </Field>
        <Field label="Partita IVA" htmlFor="vat_number" error={err("vat_number")}>
          <Input id="vat_number" name="vat_number" defaultValue={d.vat_number ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Email" htmlFor="email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={d.email ?? ""} />
        </Field>
        <Field label="Telefono" htmlFor="phone" error={err("phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={d.phone ?? ""} />
        </Field>
        <Field label="Stato" htmlFor="status">
          <Select name="status" defaultValue={d.status ?? "attivo"} disabled={readOnly}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CLIENT_STATUS).map(([v, s]) => (
                <SelectItem key={v} value={v}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Responsabile" htmlFor="owner_id">
          <Select name="owner_id" defaultValue={d.owner_id ?? undefined} disabled={readOnly}>
            <SelectTrigger id="owner_id">
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

        {!compact && (
          <>
            <p className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-2">
              Dati di fatturazione
            </p>
            <Field label="Codice fiscale" htmlFor="tax_code" error={err("tax_code")}>
              <Input id="tax_code" name="tax_code" defaultValue={d.tax_code ?? ""} />
            </Field>
            <Field label="Codice SDI" htmlFor="sdi_code" error={err("sdi_code")} hint="7 caratteri, oppure 0000000 con PEC">
              <Input id="sdi_code" name="sdi_code" defaultValue={d.sdi_code ?? ""} maxLength={7} className="uppercase" />
            </Field>
            <Field label="PEC" htmlFor="pec" error={err("pec")}>
              <Input id="pec" name="pec" type="email" defaultValue={d.pec ?? ""} />
            </Field>
            <Field label="Sito web" htmlFor="website" error={err("website")}>
              <Input id="website" name="website" defaultValue={d.website ?? ""} placeholder="https://" />
            </Field>
            <Field label="Indirizzo" htmlFor="address" className="sm:col-span-2">
              <Input id="address" name="address" defaultValue={d.address ?? ""} />
            </Field>
            <div className="grid grid-cols-[1fr_80px_100px] gap-3 sm:col-span-2">
              <Field label="Città" htmlFor="city">
                <Input id="city" name="city" defaultValue={d.city ?? ""} />
              </Field>
              <Field label="Prov." htmlFor="province">
                <Input id="province" name="province" defaultValue={d.province ?? ""} maxLength={2} className="uppercase" />
              </Field>
              <Field label="CAP" htmlFor="zip">
                <Input id="zip" name="zip" defaultValue={d.zip ?? ""} inputMode="numeric" maxLength={5} />
              </Field>
            </div>
            <Field label="Settore" htmlFor="sector">
              <Input id="sector" name="sector" defaultValue={d.sector ?? ""} placeholder="Es. Manifattura, Studio legale" />
            </Field>
            <Field label="Note" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" defaultValue={d.notes ?? ""} rows={3} />
            </Field>
          </>
        )}
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

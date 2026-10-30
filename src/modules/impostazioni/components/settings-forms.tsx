"use client";

import { useActionState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initialActionState } from "@/lib/action-result";
import type { AppRole, CompanySettingsRow, ProfileRow, SiteRow } from "@/lib/database.types";
import { ROLE_LABEL } from "@/lib/permissions";
import { changePasswordAction, updateCompanyAction, updateMemberAction, updateMyProfileAction } from "../actions";

export function CompanyForm({ company, canEdit }: { company: CompanySettingsRow; canEdit: boolean }) {
  const [state, action] = useActionState(updateCompanyAction, initialActionState);
  useActionToast(state);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const c = company;
  return (
    <ActionForm action={action} className="flex max-w-3xl flex-col gap-5">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Ragione sociale *" htmlFor="s_legal" error={err("legal_name")} className="sm:col-span-2">
          <Input id="s_legal" name="legal_name" defaultValue={c.legal_name} />
        </Field>
        <Field label="Partita IVA" htmlFor="s_vat"><Input id="s_vat" name="vat_number" defaultValue={c.vat_number ?? ""} /></Field>
        <Field label="Codice fiscale" htmlFor="s_cf"><Input id="s_cf" name="tax_code" defaultValue={c.tax_code ?? ""} /></Field>
        <Field label="Codice SDI" htmlFor="s_sdi"><Input id="s_sdi" name="sdi_code" defaultValue={c.sdi_code ?? ""} /></Field>
        <Field label="PEC" htmlFor="s_pec"><Input id="s_pec" name="pec" defaultValue={c.pec ?? ""} /></Field>
        <Field label="Email" htmlFor="s_email"><Input id="s_email" name="email" defaultValue={c.email ?? ""} /></Field>
        <Field label="Telefono" htmlFor="s_phone"><Input id="s_phone" name="phone" defaultValue={c.phone ?? ""} /></Field>
        <Field label="Sede legale" htmlFor="s_addr" className="sm:col-span-2"><Input id="s_addr" name="address" defaultValue={c.address ?? ""} /></Field>
        <Field label="IBAN" htmlFor="s_iban" className="sm:col-span-2"><Input id="s_iban" name="iban" defaultValue={c.iban ?? ""} className="font-mono" /></Field>
        <Field label="Prefisso fatture" htmlFor="s_pref" error={err("invoice_prefix")}>
          <Input id="s_pref" name="invoice_prefix" defaultValue={c.invoice_prefix} />
        </Field>
        <Field label="IVA predefinita (%)" htmlFor="s_iva" error={err("default_vat_rate")}>
          <Input id="s_iva" name="default_vat_rate" type="number" step="0.01" defaultValue={c.default_vat_rate} />
        </Field>
      </fieldset>
      {canEdit && <div><SubmitButton>Salva dati aziendali</SubmitButton></div>}
    </ActionForm>
  );
}

export function MyProfileForm({ me, sites }: { me: Pick<ProfileRow, "full_name" | "job_title" | "site_id" | "email">; sites: SiteRow[] }) {
  const [state, action] = useActionState(updateMyProfileAction, initialActionState);
  useActionToast(state);
  const [pwState, pwAction] = useActionState(changePasswordAction, initialActionState);
  const pwRef = useRef<HTMLFormElement>(null);
  useActionToast(pwState, () => pwRef.current?.reset());
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const pwErr = (k: string) => (!pwState.ok ? pwState.fieldErrors?.[k] : undefined);

  return (
    <div className="grid max-w-3xl gap-8">
      <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome e cognome" htmlFor="p_name" error={err("full_name")}>
          <Input id="p_name" name="full_name" defaultValue={me.full_name} />
        </Field>
        <Field label="Email" htmlFor="p_email" hint="Per cambiarla chiedi a un amministratore">
          <Input id="p_email" value={me.email} disabled readOnly />
        </Field>
        <Field label="Ruolo in azienda" htmlFor="p_job">
          <Input id="p_job" name="job_title" defaultValue={me.job_title ?? ""} placeholder="Es. Full-stack developer" />
        </Field>
        <Field label="Sede" htmlFor="p_site">
          <Select name="site_id" defaultValue={me.site_id ?? undefined}>
            <SelectTrigger id="p_site"><SelectValue placeholder="Da remoto" /></SelectTrigger>
            <SelectContent>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><SubmitButton>Salva profilo</SubmitButton></div>
      </ActionForm>
      <ActionForm ref={pwRef} action={pwAction} className="grid gap-4 border-t pt-6 sm:grid-cols-2">
        <p className="font-medium sm:col-span-2">Cambia password</p>
        <Field label="Nuova password" htmlFor="pw1" error={pwErr("password")}>
          <Input id="pw1" name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Ripeti password" htmlFor="pw2" error={pwErr("confirm")}>
          <Input id="pw2" name="confirm" type="password" autoComplete="new-password" />
        </Field>
        <div className="sm:col-span-2"><SubmitButton variant="outline">Aggiorna password</SubmitButton></div>
      </ActionForm>
    </div>
  );
}

export function TeamTable({ members, sites, canManage, meId }: { members: ProfileRow[]; sites: SiteRow[]; canManage: boolean; meId: string }) {
  const [pending, start] = useTransition();
  const save = (m: ProfileRow, patch: Partial<{ role: AppRole; site_id: string; active: boolean }>) =>
    start(async () => {
      const r = await updateMemberAction({
        id: m.id,
        role: patch.role ?? m.role,
        site_id: patch.site_id ?? m.site_id ?? "",
        active: patch.active ?? m.active,
      });
      if (r.ok) toast.success(r.message ?? "Salvato");
      else toast.error(r.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        Per aggiungere una persona invitala da Supabase (Authentication → Users → Invite). Compare qui come &quot;Disattivato&quot;: attivala e assegnale il ruolo.
      </p>
      <div className="rounded-lg border bg-card">
        <Table className={pending ? "opacity-70" : undefined}>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.full_name} />
                    <div>
                      <p className="font-medium">{m.full_name}{m.id === meId && <span className="text-muted-foreground"> (tu)</span>}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select value={m.role} onValueChange={(v) => save(m, { role: v as AppRole })}>
                      <SelectTrigger className="h-8 w-52 text-[13px]" aria-label={`Ruolo di ${m.full_name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    ROLE_LABEL[m.role]
                  )}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select value={m.site_id ?? undefined} onValueChange={(v) => save(m, { site_id: v })}>
                      <SelectTrigger className="h-8 w-36 text-[13px]" aria-label={`Sede di ${m.full_name}`}><SelectValue placeholder="Remoto" /></SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    sites.find((s) => s.id === m.site_id)?.name ?? "Remoto"
                  )}
                </TableCell>
                <TableCell>
                  {canManage && m.id !== meId ? (
                    <button type="button" onClick={() => save(m, { active: !m.active })} className="rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                      <Badge tone={m.active ? "success" : "neutral"}>{m.active ? "Attivo · disattiva" : "Disattivato · riattiva"}</Badge>
                    </button>
                  ) : (
                    <Badge tone={m.active ? "success" : "neutral"}>{m.active ? "Attivo" : "Disattivato"}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

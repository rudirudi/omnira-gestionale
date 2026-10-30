"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Mail, Phone, Plus, Star, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-result";
import type { ContactRow } from "@/lib/database.types";
import { addContactAction, deleteContactAction } from "../actions";

export function ContactsPanel({ clientId, contacts, canEdit }: { clientId: string; contacts: ContactRow[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [state, formAction] = useActionState(addContactAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  useActionToast(state, () => {
    formRef.current?.reset();
    setAdding(false);
  });
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !adding && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Aggiungi referente
          </Button>
        </div>
      )}
      {adding && (
        <ActionForm ref={formRef} action={formAction} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Nome *" htmlFor="c_first" error={err("first_name")}>
            <Input id="c_first" name="first_name" autoFocus />
          </Field>
          <Field label="Cognome" htmlFor="c_last">
            <Input id="c_last" name="last_name" />
          </Field>
          <Field label="Ruolo" htmlFor="c_role">
            <Input id="c_role" name="job_title" placeholder="Es. Titolare, Responsabile IT" />
          </Field>
          <Field label="Email" htmlFor="c_email" error={err("email")}>
            <Input id="c_email" name="email" type="email" />
          </Field>
          <Field label="Telefono" htmlFor="c_phone">
            <Input id="c_phone" name="phone" type="tel" />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
            <input type="checkbox" name="is_primary" className="size-4 accent-[var(--primary)]" />
            Referente principale
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Annulla
            </Button>
            <SubmitButton size="sm">Salva referente</SubmitButton>
          </div>
        </ActionForm>
      )}

      {contacts.length === 0 && !adding ? (
        <EmptyState icon={UserRound} title="Nessun referente" description="Aggiungi le persone con cui parlate in questa azienda." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
            return (
              <li key={c.id} className="flex gap-3 rounded-lg border bg-card p-4">
                <Avatar name={name} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{name}</p>
                    {c.is_primary && (
                      <Badge tone="primary">
                        <Star /> Principale
                      </Badge>
                    )}
                  </div>
                  {c.job_title && <p className="text-[13px] text-muted-foreground">{c.job_title}</p>}
                  <div className="mt-2 flex flex-col gap-1 text-[13px]">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                        <Mail className="size-3.5" /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                        <Phone className="size-3.5" /> {c.phone}
                      </a>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Elimina ${name}`}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deleteContactAction(c.id, clientId);
                        if (!r.ok) toast.error(r.error);
                        else toast.success("Referente eliminato");
                      })
                    }
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

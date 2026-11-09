"use client";

import * as React from "react";
import { useActionState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, initialActionState } from "@/lib/action-result";
import type { DiscussionRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { KIND, PRIORITY } from "./discussion-meta";

type Option = { id: string; name: string };

export function DiscussionForm({
  action,
  defaults,
  team,
  projects,
  clients,
  submitLabel,
  onSaved,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  defaults?: Partial<DiscussionRow>;
  team: { id: string; full_name: string }[];
  projects: Option[];
  clients: Option[];
  submitLabel: string;
  onSaved?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onSaved);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const d = defaults ?? {};
  const [kind, setKind] = React.useState(d.kind ?? "punto");

  return (
    <ActionForm action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => {
          const Icon = KIND[k].icon;
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(k)}
              className={cn("flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors", on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")}
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", KIND[k].tile)}>
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-[13px] font-semibold">{KIND[k].label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{k === "punto" ? "Una cosa da decidere o risolvere" : "Un argomento di cui parlare"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Field label="Titolo *" htmlFor="d_title" error={err("title")}>
        <Input id="d_title" name="title" defaultValue={d.title ?? ""} placeholder="Es. Scegliere il fornitore per l'hosting" autoFocus={!d.title} maxLength={200} />
      </Field>
      <Field label="Descrizione" htmlFor="d_body" error={err("body")} hint="Contesto, opzioni, link: le risposte arrivano sotto">
        <Textarea id="d_body" name="body" defaultValue={d.body ?? ""} rows={4} maxLength={10000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Responsabile" htmlFor="d_owner" hint="Chi lo porta avanti">
          <Select name="owner_id" defaultValue={d.owner_id ?? "nessuno"}>
            <SelectTrigger id="d_owner"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nessuno">Nessuno</SelectItem>
              {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priorità" htmlFor="d_priority">
          <Select name="priority" defaultValue={d.priority ?? "normale"}>
            <SelectTrigger id="d_priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Entro il" htmlFor="d_due" error={err("due_date")}>
          <Input id="d_due" name="due_date" type="date" defaultValue={d.due_date ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Progetto" htmlFor="d_project">
          <Select name="project_id" defaultValue={d.project_id ?? "nessuno"}>
            <SelectTrigger id="d_project"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nessuno">Nessuno</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cliente" htmlFor="d_client">
          <Select name="client_id" defaultValue={d.client_id ?? "nessuno"}>
            <SelectTrigger id="d_client"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nessuno">Nessuno</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

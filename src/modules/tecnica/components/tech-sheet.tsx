"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Cloud,
  Code2,
  ExternalLink,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Rocket,
  ShieldAlert,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-result";
import type { ProjectServiceRow, TechServiceCategory } from "@/lib/database.types";
import { cn, formatDate } from "@/lib/utils";
import { deleteServiceAction, saveServiceAction, saveTechAction } from "../actions";
import type { ProjectTechData } from "../queries";

export const CATEGORY: Record<TechServiceCategory, { label: string; cls: string }> = {
  hosting: { label: "Hosting", cls: "bg-work/12 text-work-ink" },
  database: { label: "Database", cls: "bg-[oklch(0.55_0.15_300)]/12 text-[oklch(0.45_0.15_300)] dark:text-[oklch(0.8_0.1_300)]" },
  dominio: { label: "Dominio / DNS", cls: "bg-sales/20 text-sales-ink" },
  email: { label: "Email", cls: "bg-[oklch(0.6_0.12_200)]/14 text-[oklch(0.45_0.1_200)] dark:text-[oklch(0.8_0.08_200)]" },
  ai: { label: "AI", cls: "bg-[oklch(0.6_0.18_330)]/12 text-[oklch(0.5_0.18_330)] dark:text-[oklch(0.8_0.12_330)]" },
  pagamenti: { label: "Pagamenti", cls: "bg-money/12 text-money-ink" },
  storage: { label: "File / storage", cls: "bg-muted text-foreground" },
  analytics: { label: "Analytics", cls: "bg-muted text-foreground" },
  monitoraggio: { label: "Monitoraggio", cls: "bg-destructive/10 text-destructive" },
  repository: { label: "Codice / repository", cls: "bg-foreground/10 text-foreground" },
  altro: { label: "Altro", cls: "bg-muted text-muted-foreground" },
};

const host = (u: string) => {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, "") + x.pathname).replace(/\/$/, "");
  } catch {
    return u;
  }
};

export function TechSheet({ projectId, data }: { projectId: string; data: ProjectTechData }) {
  const { tech, services, suggestions } = data;
  const [editing, setEditing] = React.useState(false);
  const [svc, setSvc] = React.useState<ProjectServiceRow | "new" | null>(null);
  const empty = !tech && services.length === 0;

  const links = [
    { label: "Repository", icon: GitBranch, url: tech?.repo_url },
    { label: "Produzione", icon: Rocket, url: tech?.prod_url },
    { label: "Staging / test", icon: TestTube2, url: tech?.staging_url },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12.5px] text-sales-ink">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Qui si scrive come è fatto il progetto. Password e chiavi API non vanno salvate qui: restano nei pannelli dei fornitori o nel gestore password.
      </p>

      {editing ? (
        <TechForm projectId={projectId} data={data} onDone={() => setEditing(false)} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card
              title="Link"
              icon={Globe}
              action={
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> {empty ? "Compila la scheda" : "Modifica"}
                </Button>
              }
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {links.map((l) =>
                  l.url ? (
                    <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5 hover:border-primary hover:bg-primary/5">
                      <l.icon className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">{l.label}</span>
                        <span className="block truncate text-[13px] font-medium group-hover:underline">{host(l.url)}</span>
                      </span>
                      <ExternalLink className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <div key={l.label} className="flex items-center gap-2.5 rounded-lg border border-dashed p-2.5 text-muted-foreground">
                      <l.icon className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[11px]">{l.label}</span>
                        <span className="block text-[13px]">—</span>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </Card>

            <Card title="Tecnologie" icon={Code2}>
              <Chips items={tech?.stack ?? []} empty="Nessuna tecnologia indicata" tone="bg-primary/10 text-primary dark:text-[oklch(0.82_0.08_262)]" />
            </Card>

            <Card title="Pattern e architettura" icon={Layers}>
              <Chips items={tech?.patterns ?? []} empty="Nessun pattern indicato" tone="bg-[oklch(0.55_0.15_300)]/12 text-[oklch(0.45_0.15_300)] dark:text-[oklch(0.8_0.1_300)]" />
            </Card>

            <Card title="Note tecniche" icon={NotebookPen}>
              {tech?.notes ? (
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{tech.notes}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Scelte di progetto, flussi principali, come si fa il deploy, cose da sapere prima di mettere le mani sul codice.
                </p>
              )}
              {tech && (
                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Aggiornata {tech.editor?.full_name ? `da ${tech.editor.full_name} ` : ""}il {formatDate(tech.updated_at)}
                </p>
              )}
            </Card>
          </div>

          <Card
            title={`Servizi esterni · ${services.length}`}
            icon={Cloud}
            action={
              <Button size="sm" onClick={() => setSvc("new")}>
                <Plus /> Aggiungi
              </Button>
            }
          >
            {services.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Hosting, database, dominio, email, AI… ogni fornitore usato dal progetto, con a cosa serve e di chi è l&apos;account.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {services.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setSvc(s)} className="flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-muted/40">
                      <span className="flex items-center gap-2">
                        <Boxes className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate text-[14px] font-semibold">{s.provider}</span>
                        <span className={cn("ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", CATEGORY[s.category].cls)}>{CATEGORY[s.category].label}</span>
                      </span>
                      {s.purpose && <span className="text-[12.5px] text-muted-foreground">{s.purpose}</span>}
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                        <span className={cn("rounded-full px-1.5 py-0.5 font-medium", s.owner === "cliente" ? "bg-sales/20 text-sales-ink" : "bg-primary/10 text-primary")}>
                          Account {s.owner === "cliente" ? "del cliente" : "Omnira"}
                        </span>
                        {s.plan && <span>Piano: {s.plan}</span>}
                        {s.account && <span className="truncate">· {s.account}</span>}
                        {s.dashboard_url && (
                          <a href={s.dashboard_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 font-medium text-primary hover:underline">
                            Pannello <ExternalLink className="size-3" />
                          </a>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <ServiceDialog projectId={projectId} value={svc} providers={suggestions.providers} onClose={() => setSvc(null)} />
    </div>
  );
}

function Card({ title, icon: Icon, action, children }: { title: string; icon: typeof Globe; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function Chips({ items, empty, tone }: { items: string[]; empty: string; tone: string }) {
  if (items.length === 0) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-medium", tone)}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** Etichette: scrivi e premi Invio (o virgola); sotto, i suggerimenti più usati */
function TagInput({ id, value, onChange, suggestions, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string }) {
  const [draft, setDraft] = React.useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft("");
  };
  const free = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 14);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-[12.5px] font-medium text-primary">
            {t}
            <button type="button" aria-label={`Togli ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-primary/20">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={`${id}-list`}
          value={draft}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-[13px] outline-none"
        />
        <datalist id={`${id}-list`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {free.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {free.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed px-2 py-0.5 text-[11.5px] text-muted-foreground hover:border-primary hover:text-primary">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TechForm({ projectId, data, onDone }: { projectId: string; data: ProjectTechData; onDone: () => void }) {
  const router = useRouter();
  const t = data.tech;
  const [stack, setStack] = React.useState(t?.stack ?? []);
  const [patterns, setPatterns] = React.useState(t?.patterns ?? []);
  const [form, setForm] = React.useState({ repo_url: t?.repo_url ?? "", prod_url: t?.prod_url ?? "", staging_url: t?.staging_url ?? "", notes: t?.notes ?? "" });
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();

  const save = () =>
    start(async () => {
      const res = await saveTechAction(projectId, { stack, patterns, ...form });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
      onDone();
    });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Repository" htmlFor="t_repo" error={errors.repo_url}>
          <Input id="t_repo" value={form.repo_url} onChange={set("repo_url")} placeholder="github.com/omnira/progetto" />
        </Field>
        <Field label="Produzione" htmlFor="t_prod" error={errors.prod_url}>
          <Input id="t_prod" value={form.prod_url} onChange={set("prod_url")} placeholder="www.cliente.it" />
        </Field>
        <Field label="Staging / test" htmlFor="t_stg" error={errors.staging_url}>
          <Input id="t_stg" value={form.staging_url} onChange={set("staging_url")} placeholder="progetto.vercel.app" />
        </Field>
      </div>
      <Field label="Tecnologie" htmlFor="t_stack" hint="Linguaggi, framework, librerie, CMS">
        <TagInput id="t_stack" value={stack} onChange={setStack} suggestions={data.suggestions.stack} placeholder="Es. Next.js, Supabase…" />
      </Field>
      <Field label="Pattern e architettura" htmlFor="t_pat" hint="Come è organizzato: API, code, webhook, autenticazione…">
        <TagInput id="t_pat" value={patterns} onChange={setPatterns} suggestions={data.suggestions.patterns} placeholder="Es. Server Actions, Webhook…" />
      </Field>
      <Field label="Note tecniche" htmlFor="t_notes" error={errors.notes} hint="Scelte fatte e perché, flussi principali, deploy, cose da sapere">
        <Textarea id="t_notes" rows={8} value={form.notes} onChange={set("notes")} maxLength={20000} placeholder={"Es.\n- Deploy automatico su Vercel a ogni push su main\n- Cron giornaliero alle 6:00 per le scadenze\n- Le email partono da Resend (dominio omnirasoft.it)"} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Salva scheda
        </Button>
      </div>
    </section>
  );
}

function ServiceDialog({ projectId, value, providers, onClose }: { projectId: string; value: ProjectServiceRow | "new" | null; providers: string[]; onClose: () => void }) {
  const s = value && value !== "new" ? value : null;
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{s ? s.provider : "Aggiungi un servizio esterno"}</DialogTitle>
          <DialogDescription>Il fornitore, a cosa serve nel progetto e di chi è l&apos;account. Niente password.</DialogDescription>
        </DialogHeader>
        {value !== null && <ServiceForm key={s?.id ?? "new"} projectId={projectId} service={s} providers={providers} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({ projectId, service, providers, onDone }: { projectId: string; service: ProjectServiceRow | null; providers: string[]; onDone: () => void }) {
  const action = React.useMemo(() => saveServiceAction.bind(null, projectId, service?.id ?? null), [projectId, service?.id]);
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const [removing, start] = React.useTransition();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);

  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Fornitore *" htmlFor="s_provider" error={err("provider")}>
        <Input id="s_provider" name="provider" list="s_provider_list" defaultValue={service?.provider ?? ""} placeholder="Es. Vercel" autoFocus={!service} />
        <datalist id="s_provider_list">
          {providers.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Tipo" htmlFor="s_cat">
        <Select name="category" defaultValue={service?.category ?? "hosting"}>
          <SelectTrigger id="s_cat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CATEGORY) as TechServiceCategory[]).map((k) => (
              <SelectItem key={k} value={k}>
                {CATEGORY[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="A cosa serve" htmlFor="s_purpose" error={err("purpose")} className="sm:col-span-2">
        <Input id="s_purpose" name="purpose" defaultValue={service?.purpose ?? ""} placeholder="Es. Hosting del frontend e deploy automatico da GitHub" />
      </Field>
      <Field label="Account" htmlFor="s_owner">
        <Select name="owner" defaultValue={service?.owner ?? "omnira"}>
          <SelectTrigger id="s_owner">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="omnira">Nostro (Omnira)</SelectItem>
            <SelectItem value="cliente">Del cliente</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Piano" htmlFor="s_plan" error={err("plan")}>
        <Input id="s_plan" name="plan" defaultValue={service?.plan ?? ""} placeholder="Es. Pro, Free, Pay as you go" />
      </Field>
      <Field label="Account / email di riferimento" htmlFor="s_account" error={err("account")}>
        <Input id="s_account" name="account" defaultValue={service?.account ?? ""} placeholder="Es. team Omnira, info@cliente.it" />
      </Field>
      <Field label="Link al pannello" htmlFor="s_url" error={err("dashboard_url")}>
        <Input id="s_url" name="dashboard_url" defaultValue={service?.dashboard_url ?? ""} placeholder="vercel.com/omnira/progetto" />
      </Field>
      <Field label="Note" htmlFor="s_notes" error={err("notes")} className="sm:col-span-2">
        <Textarea id="s_notes" name="notes" rows={3} defaultValue={service?.notes ?? ""} placeholder="Es. regione EU, variabili d'ambiente su Vercel, limiti del piano" />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        {service && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-muted-foreground", confirm && "text-destructive")}
            disabled={removing}
            onBlur={() => setConfirm(false)}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              start(async () => {
                const res = await deleteServiceAction(projectId, service.id);
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message);
                router.refresh();
                onDone();
              });
            }}
          >
            <Trash2 /> {confirm ? "Conferma" : "Rimuovi"}
          </Button>
        )}
        <span className="ml-auto">
          <SubmitButton>{service ? "Salva" : "Aggiungi"}</SubmitButton>
        </span>
      </div>
    </ActionForm>
  );
}

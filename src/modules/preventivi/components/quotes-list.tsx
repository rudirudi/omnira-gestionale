"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { FileSignature, Plus, Repeat } from "lucide-react";
import { ActionForm } from "@/components/app/action-form";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-result";
import { QUOTE_STATE, type QuoteDisplayState } from "@/lib/labels";
import { replaceUrl } from "@/lib/url-state";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { createQuoteAction } from "../actions";
import type { QuoteListItem } from "../queries";
import { displayState, quoteTotals } from "../totals";

type Recipients = {
  clients: { id: string; name: string }[];
  leads: { id: string; title: string; company_name: string | null; client_id: string | null }[];
};

const FILTERS: { value: "tutti" | QuoteDisplayState; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "bozza", label: "Bozze" },
  { value: "inviato", label: "In attesa" },
  { value: "scaduto", label: "Scaduti" },
  { value: "accettato", label: "Accettati" },
  { value: "rifiutato", label: "Rifiutati" },
];

export function QuotesList({
  quotes,
  recipients,
  initialRecipient,
  openNew,
}: {
  quotes: QuoteListItem[];
  recipients: Recipients;
  initialRecipient?: string;
  openNew?: boolean;
}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["value"]>("tutti");
  const [creating, setCreating] = React.useState(!!openNew);
  const rows = quotes.map((q) => ({ ...q, state: displayState(q), totals: quoteTotals(q.quote_items, q.discount_cents, q.vat_rate) }));
  const shown = rows.filter((r) => filter === "tutti" || r.state === filter);

  const year = String(new Date().getFullYear());
  const waiting = rows.filter((r) => r.state === "inviato");
  const acceptedYear = rows.filter((r) => r.state === "accettato" && r.issue_date.startsWith(year));
  const decided = rows.filter((r) => r.state === "accettato" || r.state === "rifiutato");
  const rate = decided.length ? Math.round((rows.filter((r) => r.state === "accettato").length / decided.length) * 100) : null;
  const drafts = rows.filter((r) => r.state === "bozza");

  const closeNew = () => {
    setCreating(false);
    replaceUrl("/preventivi");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="In attesa di risposta" value={formatEuro(waiting.reduce((s, r) => s + r.totals.total, 0))} sub={`${waiting.length} preventivi inviati`} tone="primary" />
        <Stat label={`Accettati nel ${year}`} value={formatEuro(acceptedYear.reduce((s, r) => s + r.totals.total, 0))} sub={`${acceptedYear.length} preventivi`} tone="success" />
        <Stat label="Tasso di accettazione" value={rate === null ? "—" : `${rate}%`} sub={decided.length ? `su ${decided.length} decisi` : "nessun preventivo deciso"} tone="sales" />
        <Stat label="Bozze" value={String(drafts.length)} sub={drafts.length ? "da completare e inviare" : "nessuna bozza"} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Filtra">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", filter === f.value && "bg-muted text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto bg-sales text-on-warning hover:bg-sales/90" onClick={() => setCreating(true)}>
          <Plus /> Nuovo preventivo
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          area="sales"
          icon={FileSignature}
          title={rows.length ? "Niente in questo filtro" : "Nessun preventivo"}
          description={rows.length ? "Prova un altro filtro." : "Crea il primo preventivo da un lead o da un cliente: quando viene accettato diventa progetto e incassi."}
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => {
            const st = QUOTE_STATE[r.state];
            const who = r.client?.name ?? r.lead?.company_name ?? r.lead?.title ?? "—";
            return (
              <li key={r.id}>
                <Link
                  href={`/preventivi/${r.id}`}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-xl border border-l-4 bg-card p-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[110px_1fr_auto_auto]",
                    r.state === "accettato" ? "border-l-success" : r.state === "rifiutato" ? "border-l-destructive" : r.state === "scaduto" ? "border-l-warning" : r.state === "inviato" ? "border-l-primary" : "border-l-muted-foreground/30",
                  )}
                >
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">{r.number}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono sm:hidden">{r.number} · </span>
                      {who}
                      {!r.client && r.lead && <span className="ml-1.5 rounded bg-sales/20 px-1 text-[10px] font-semibold text-sales-ink">LEAD</span>}
                      {" · "}
                      {formatDate(r.issue_date)}
                      {r.state === "inviato" && ` · valido fino al ${formatDate(r.valid_until)}`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[13px] font-semibold tabular">{formatEuro(r.totals.total)}</span>
                    {r.totals.recurringYearly > 0 && (
                      <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground tabular">
                        <Repeat className="size-3" /> + {formatEuro(r.totals.recurringYearly)}/anno
                      </span>
                    )}
                  </span>
                  <Badge dot tone={st.tone} className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
                    {st.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(o) => (o ? setCreating(true) : closeNew())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo preventivo</DialogTitle>
            <DialogDescription>Poi aggiungi le voci, i prezzi e le condizioni nella pagina del preventivo.</DialogDescription>
          </DialogHeader>
          <NewQuoteForm recipients={recipients} initialRecipient={initialRecipient} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewQuoteForm({ recipients, initialRecipient }: { recipients: Recipients; initialRecipient?: string }) {
  const [state, action] = useActionState(createQuoteAction, initialActionState);
  useActionToast(state);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const lead = initialRecipient?.startsWith("lead:") ? recipients.leads.find((l) => `lead:${l.id}` === initialRecipient) : null;
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <Field label="Per chi è *" htmlFor="q_recipient" error={err("recipient")}>
        <Select name="recipient" defaultValue={initialRecipient}>
          <SelectTrigger id="q_recipient"><SelectValue placeholder="Scegli un cliente o un lead…" /></SelectTrigger>
          <SelectContent>
            {recipients.leads.length > 0 && (
              <SelectGroup>
                <SelectLabel>Lead aperti</SelectLabel>
                {recipients.leads.map((l) => (
                  <SelectItem key={l.id} value={`lead:${l.id}`}>
                    {l.title}
                    {l.company_name ? ` · ${l.company_name}` : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel>Clienti</SelectLabel>
              {recipients.clients.map((c) => (
                <SelectItem key={c.id} value={`client:${c.id}`}>{c.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Titolo *" htmlFor="q_title" error={err("title")} hint="Es. Sito vetrina 5 pagine, Gestionale magazzino">
        <Input id="q_title" name="title" defaultValue={lead?.title ?? ""} autoFocus />
      </Field>
      <div className="flex justify-end">
        <SubmitButton className="bg-sales text-on-warning hover:bg-sales/90">Crea e compila</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "primary" | "sales" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone === "success" ? "bg-success" : tone === "primary" ? "bg-primary" : tone === "sales" ? "bg-sales" : "bg-muted-foreground/40")} aria-hidden />
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

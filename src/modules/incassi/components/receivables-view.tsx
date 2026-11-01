"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Plus, Repeat, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_METHOD, RECEIVABLE_STATE, type ReceivableState } from "@/lib/labels";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { createReceivableAction, deletePaymentAction, deleteReceivableAction, updateReceivableAction } from "../actions";
import { totals } from "../balance";
import type { ReceivableItem } from "../queries";
import { PaymentForm, ReceivableForm } from "./receivable-forms";

type Opt = { id: string; name: string };
type ProjectOpt = { id: string; code: string | null; name: string; client_id: string | null };

const FILTERS: { value: "aperti" | ReceivableState | "tutti"; label: string }[] = [
  { value: "aperti", label: "Da incassare" },
  { value: "scaduto", label: "Scaduti" },
  { value: "parziale", label: "Pagati in parte" },
  { value: "pagato", label: "Pagati" },
  { value: "tutti", label: "Tutti" },
];

/** Barra pagato/residuo: verde pagato, rosso se scaduto, giallo se parziale */
function PaidBar({ paid, total, state }: { paid: number; total: number; state: ReceivableState }) {
  const pct = total ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={cn("h-full rounded-full", state === "pagato" ? "bg-success" : state === "scaduto" ? "bg-destructive" : "bg-warning")} style={{ width: `${Math.max(pct, state === "pagato" ? 100 : 0)}%` }} />
    </div>
  );
}

export function ReceivablesView({
  items,
  canManage,
  canDelete,
  clients,
  projects,
  newDefaults,
  showClient = true,
  showProject = true,
  showFilters = true,
  compact = false,
}: {
  items: ReceivableItem[];
  canManage: boolean;
  canDelete: boolean;
  clients: Opt[];
  projects: ProjectOpt[];
  newDefaults?: { client_id?: string; project_id?: string; description?: string; amount_cents?: number };
  showClient?: boolean;
  showProject?: boolean;
  showFilters?: boolean;
  compact?: boolean;
}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["value"]>(showFilters ? "aperti" : "tutti");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [, start] = React.useTransition();
  const t = totals(items);
  const shown = items.filter((r) =>
    filter === "tutti" ? true : filter === "aperti" ? r.state !== "pagato" : r.state === filter,
  );
  const open = items.find((r) => r.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Riepilogo */}
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
        <Stat label="Totale dovuto" value={formatEuro(t.total)} />
        <Stat label="Incassato" value={formatEuro(t.paid)} tone="success" sub={t.total ? `${Math.round((t.paid / t.total) * 100)}% del totale` : undefined} />
        <Stat label="Da incassare" value={formatEuro(t.remaining)} tone="warning" />
        {!compact && <Stat label="Scaduto" value={formatEuro(t.overdue)} tone="danger" sub={t.overdueCount ? `${t.overdueCount} importi oltre la data` : "nessun ritardo"} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showFilters && (
          <div className="flex items-center gap-1 rounded-md border bg-card p-0.5" role="group" aria-label="Filtra">
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
        )}
        {canManage && (
          <Button size="sm" className="ml-auto bg-money hover:bg-money/90" onClick={() => setCreating(true)}>
            <Plus /> Nuovo importo da incassare
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          area="money"
          icon={Wallet}
          title={items.length ? "Niente in questo filtro" : "Nessun importo"}
          description={items.length ? "Prova un altro filtro." : "Aggiungi quanto deve pagare il cliente: poi registri i pagamenti man mano che arrivano."}
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => {
            const st = RECEIVABLE_STATE[r.state];
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-xl border border-l-4 bg-card p-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[1fr_180px_auto]",
                    r.state === "pagato" ? "border-l-success" : r.state === "scaduto" ? "border-l-destructive" : r.state === "parziale" ? "border-l-warning" : "border-l-muted-foreground/30",
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-[13px] font-semibold">
                      {r.renewal && <Repeat className="size-3.5 shrink-0 text-money-ink" aria-label="Rinnovo" />}
                      {r.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {showClient && r.client?.name}
                      {showClient && showProject && r.project && " · "}
                      {showProject && r.project && `${r.project.code} ${r.project.name}`}
                      {r.due_date && (
                        <span className={cn("ml-2 inline-flex items-center gap-1", r.state === "scaduto" && "font-medium text-destructive")}>
                          <CalendarDays className="inline size-3" /> entro {formatDate(r.due_date)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="order-3 col-span-2 flex flex-col gap-1 sm:order-none sm:col-span-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular">
                      <span>pagato {formatEuro(r.paid)}</span>
                      <span>su {formatEuro(r.amount_cents)}</span>
                    </div>
                    <PaidBar paid={r.paid} total={r.amount_cents} state={r.state} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge dot tone={st.tone}>{st.label}</Badge>
                    {r.remaining > 0 && <span className="text-[13px] font-semibold tabular">{formatEuro(r.remaining)}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Nuovo importo */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo importo da incassare</DialogTitle>
            <DialogDescription>Es. il prezzo di un sito, un acconto o una rata. I pagamenti si registrano dopo, anche in più volte.</DialogDescription>
          </DialogHeader>
          <ReceivableForm action={createReceivableAction} clients={clients} projects={projects} defaults={newDefaults} submitLabel="Aggiungi importo" isNew onDone={() => setCreating(false)} />
        </DialogContent>
      </Dialog>

      {/* Dettaglio importo */}
      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpenId(null); setEditing(false); } }}>
        <DialogContent side="right" className="flex flex-col gap-5 overflow-y-auto">
          {open && (
            <>
              <DialogHeader className="pr-8">
                <Badge dot tone={RECEIVABLE_STATE[open.state].tone} className="w-fit">{RECEIVABLE_STATE[open.state].label}</Badge>
                <DialogTitle className="text-lg">{open.description}</DialogTitle>
                <DialogDescription>
                  <Link href={`/clienti/${open.client?.id}`} className="hover:underline">{open.client?.name}</Link>
                  {open.project && (
                    <> · <Link href={`/progetti/${open.project.id}?scheda=pagamenti`} className="hover:underline">{open.project.code} {open.project.name}</Link></>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Importo" value={formatEuro(open.amount_cents)} />
                <Mini label="Pagato" value={formatEuro(open.paid)} tone="success" />
                <Mini label="Residuo" value={formatEuro(open.remaining)} tone={open.remaining ? (open.state === "scaduto" ? "danger" : "warning") : "success"} />
              </div>
              <PaidBar paid={open.paid} total={open.amount_cents} state={open.state} />

              {open.remaining > 0 && canManage ? (
                <PaymentForm key={`${open.id}-${open.paid}`} receivableId={open.id} remainingCents={open.remaining} />
              ) : open.remaining === 0 ? (
                <p className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-[13px] font-medium text-success">
                  <CheckCircle2 className="size-4" /> Saldato{open.lastPaidOn ? ` il ${formatDate(open.lastPaidOn)}` : ""}
                </p>
              ) : null}

              <section>
                <p className="mb-2 text-[13px] font-semibold">Pagamenti ricevuti</p>
                {open.payments.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nessun pagamento registrato.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {open.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                        <span className="w-20 text-muted-foreground tabular">{formatDate(p.paid_on)}</span>
                        <span className="font-semibold text-money-ink tabular">{formatEuro(p.amount_cents)}</span>
                        <span className="text-muted-foreground">{PAYMENT_METHOD[p.method]}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.note}</span>
                        {canManage && (
                          <button
                            type="button"
                            aria-label="Elimina pagamento"
                            onClick={() => start(async () => { const r = await deletePaymentAction(p.id); if (r.ok) toast.success(r.message); else toast.error(r.error); })}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {open.notes && <p className="rounded-lg bg-muted/60 p-3 text-[13px] whitespace-pre-wrap">{open.notes}</p>}

              {canManage && (
                <section className="border-t pt-4">
                  {editing ? (
                    <ReceivableForm
                      action={updateReceivableAction.bind(null, open.id)}
                      clients={clients}
                      projects={projects}
                      defaults={open}
                      submitLabel="Salva modifiche"
                      onDone={() => setEditing(false)}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Modifica importo</Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => start(async () => { const r = await deleteReceivableAction(open.id); if (r.ok) { toast.success(r.message); setOpenId(null); } else toast.error(r.error); })}
                        >
                          <Trash2 /> Elimina
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : "bg-money")} aria-hidden />
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular", tone === "danger" && value !== formatEuro(0) && "text-destructive")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className={cn("rounded-lg border p-2.5", tone === "success" && "border-success/30 bg-success/[0.06]", tone === "warning" && "border-warning/50 bg-warning/[0.12]", tone === "danger" && "border-destructive/30 bg-destructive/[0.05]")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[15px] font-semibold tabular">{value}</p>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AppWindow,
  BadgeCheck,
  CalendarClock,
  Globe,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Server,
  ServerCog,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RenewalType } from "@/lib/database.types";
import { RENEWAL_FREQUENCY, RENEWAL_TYPE } from "@/lib/labels";
import { replaceUrl } from "@/lib/url-state";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { createRenewalAction, renewAction, setRenewalActiveAction, setRenewalAutoAction, updateRenewalAction } from "../actions";
import type { RenewalItem } from "../queries";
import { RenewalForm } from "./renewal-form";

const ICON: Record<RenewalType, LucideIcon> = {
  dominio: Globe,
  hosting: ServerCog,
  server: Server,
  ssl: ShieldCheck,
  email: Mail,
  licenza: KeyRound,
  saas: AppWindow,
  manutenzione: Wrench,
  altro: BadgeCheck,
};

function daysLeft(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function whenLabel(d: number) {
  if (d < -1) return `Scaduto da ${-d} giorni`;
  if (d === -1) return "Scaduto ieri";
  if (d === 0) return "Scade oggi";
  if (d === 1) return "Scade domani";
  return `Tra ${d} giorni`;
}

type Group = { key: string; label: string; dot: string; border: string; items: (RenewalItem & { days: number })[] };

export function RenewalsView({
  items,
  canManage,
  clients,
  projects,
  defaultClientId,
  showClient = true,
  compact = false,
}: {
  items: RenewalItem[];
  canManage: boolean;
  clients: { id: string; name: string }[];
  projects: { id: string; code: string | null; name: string; client_id: string | null }[];
  defaultClientId?: string;
  showClient?: boolean;
  compact?: boolean;
}) {
  const params = useSearchParams();
  const openId = params.get("aperto");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [renewing, setRenewing] = React.useState<RenewalItem | null>(null);
  const [createRec, setCreateRec] = React.useState(true);
  const [createExp, setCreateExp] = React.useState(true);
  const [busy, start] = React.useTransition();
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("aperto", id);
    else next.delete("aperto");
    replaceUrl(`${window.location.pathname}?${next.toString()}`);
  };

  const withDays = items.filter((r) => r.active).map((r) => ({ ...r, days: daysLeft(r.next_due_date) }));
  const groups: Group[] = [
    { key: "scadute", label: "Scadute, da rinnovare", dot: "bg-destructive", border: "border-l-destructive", items: withDays.filter((r) => r.days < 0) },
    { key: "30", label: "Entro 30 giorni", dot: "bg-warning", border: "border-l-warning", items: withDays.filter((r) => r.days >= 0 && r.days <= 30) },
    { key: "90", label: "Entro 3 mesi", dot: "bg-work", border: "border-l-work", items: withDays.filter((r) => r.days > 30 && r.days <= 90) },
    { key: "dopo", label: "Più avanti", dot: "bg-success", border: "border-l-success/60", items: withDays.filter((r) => r.days > 90) },
  ];
  const inactive = items.filter((r) => !r.active);
  const yearly = withDays.reduce(
    (acc, r) => {
      const n = RENEWAL_FREQUENCY[r.frequency]!.perYear;
      acc.cost += (r.cost_cents ?? 0) * n;
      acc.price += (r.price_cents ?? 0) * n;
      return acc;
    },
    { cost: 0, price: 0 },
  );
  const open = items.find((r) => r.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Scadute" value={String(groups[0]!.items.length)} tone="danger" sub="da rinnovare subito" />
          <Kpi label="Entro 30 giorni" value={String(groups[1]!.items.length)} tone="warning" sub="già avvisate" />
          <Kpi label="Ricavo annuo dai rinnovi" value={formatEuro(yearly.price)} tone="success" sub={`costo ${formatEuro(yearly.cost)}`} />
          <Kpi label="Margine annuo" value={formatEuro(yearly.price - yearly.cost)} tone="money" sub={`${withDays.length} servizi attivi`} />
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-money hover:bg-money/90" onClick={() => setCreating(true)}>
            <Plus /> Nuova scadenza
          </Button>
        </div>
      )}

      {withDays.length === 0 ? (
        <EmptyState
          area="money"
          icon={CalendarClock}
          title="Nessuna scadenza"
          description="Aggiungi domini, hosting, server e licenze: ti avviso un mese prima di ogni scadenza."
          className="py-10"
        />
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                <span className={cn("size-2 rounded-full", g.dot)} aria-hidden />
                <span className={cn(g.key === "scadute" && "text-destructive")}>{g.label}</span>
                <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular">{g.items.length}</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((r) => {
                  const Icon = ICON[r.type];
                  return (
                    <li key={r.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-l-4 bg-card p-3 shadow-xs", g.border)}>
                      <button type="button" onClick={() => setOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-money/10 text-money-ink">
                          <Icon className="size-[18px]" strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {RENEWAL_TYPE[r.type]}
                            {r.provider && ` · ${r.provider}`}
                            {showClient && ` · ${r.client?.name ?? "Interno Omnira"}`}
                            {` · ${RENEWAL_FREQUENCY[r.frequency]!.label.toLowerCase()}`}
                          </span>
                        </span>
                      </button>
                      <div className="text-right">
                        <p className={cn("text-[13px] font-semibold", r.days < 0 ? "text-destructive" : r.days <= 30 ? "text-[oklch(0.55_0.13_75)] dark:text-warning" : "")}>
                          {whenLabel(r.days)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular">{formatDate(r.next_due_date)}</p>
                      </div>
                      <div className="hidden w-24 text-right sm:block">
                        <p className="text-[13px] font-semibold tabular">{r.price_cents != null ? formatEuro(r.price_cents) : "—"}</p>
                        <p className="text-[11px] text-muted-foreground">al cliente</p>
                      </div>
                      {canManage && (
                        <Button
                          size="sm"
                          variant={r.days <= 30 ? "default" : "outline"}
                          className={cn(r.days <= 30 && "bg-money hover:bg-money/90")}
                          onClick={() => {
                            setCreateRec(Boolean(r.client_id && r.price_cents));
                            setRenewing(r);
                          }}
                        >
                          <RefreshCw /> Rinnova
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
      )}

      {inactive.length > 0 && (
        <details className="rounded-xl border bg-card p-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-muted-foreground">Disattivate ({inactive.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {inactive.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <button type="button" className="truncate hover:underline" onClick={() => setOpen(r.id)}>
                  {RENEWAL_TYPE[r.type]} · {r.name}
                </button>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => start(async () => { const x = await setRenewalActiveAction(r.id, true); if (x.ok) toast.success(x.message); else toast.error(x.error); })}>
                    Riattiva
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Nuova scadenza */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuova scadenza</DialogTitle>
            <DialogDescription>Dominio, hosting, server, licenza… Ti avviso prima della data (di default 30 giorni).</DialogDescription>
          </DialogHeader>
          <RenewalForm action={createRenewalAction} clients={clients} projects={projects} defaults={{ client_id: defaultClientId ?? null }} submitLabel="Aggiungi scadenza" onDone={() => setCreating(false)} />
        </DialogContent>
      </Dialog>

      {/* Rinnovo */}
      <Dialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(null)}>
        <DialogContent>
          {renewing && (
            <>
              <DialogHeader>
                <DialogTitle>Rinnovare {renewing.name}?</DialogTitle>
                <DialogDescription>
                  La scadenza passa dal {formatDate(renewing.next_due_date)} al periodo successivo ({RENEWAL_FREQUENCY[renewing.frequency]!.label.toLowerCase()}).
                </DialogDescription>
              </DialogHeader>
              {renewing.client_id && renewing.price_cents ? (
                <label className="flex items-start gap-2 rounded-lg border border-money/30 bg-money/[0.05] p-3 text-[13px]">
                  <input type="checkbox" checked={createRec} onChange={(e) => setCreateRec(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                  <span>
                    Aggiungi <strong>{formatEuro(renewing.price_cents)}</strong> agli incassi da {renewing.client?.name}
                    <span className="block text-xs text-muted-foreground">Così vedi se il cliente ha pagato il rinnovo.</span>
                  </span>
                </label>
              ) : (
                <p className="text-[13px] text-muted-foreground">Nessun prezzo al cliente impostato: non verrà creato nessun importo da incassare.</p>
              )}
              {renewing.cost_cents ? (
                <label className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.04] p-3 text-[13px]">
                  <input type="checkbox" checked={createExp} onChange={(e) => setCreateExp(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                  <span>
                    Registra <strong>{formatEuro(renewing.cost_cents)}</strong> tra le spese{renewing.provider ? ` (${renewing.provider})` : ""}
                    <span className="block text-xs text-muted-foreground">È quanto paghi tu al fornitore per il rinnovo.</span>
                  </span>
                </label>
              ) : null}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRenewing(null)}>Annulla</Button>
                <Button
                  className="bg-money hover:bg-money/90"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const x = await renewAction(renewing.id, createRec && Boolean(renewing.client_id && renewing.price_cents), createExp && Boolean(renewing.cost_cents));
                      if (x.ok) {
                        toast.success(x.message);
                        setRenewing(null);
                      } else toast.error(x.error);
                    })
                  }
                >
                  <RefreshCw /> Conferma rinnovo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dettaglio / modifica */}
      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setEditing(false); } }}>
        <DialogContent side="right" className="flex flex-col gap-4 overflow-y-auto">
          {open && (
            <>
              <DialogHeader className="pr-8">
                <Badge dot tone={daysLeft(open.next_due_date) < 0 ? "danger" : daysLeft(open.next_due_date) <= 30 ? "warning" : "success"} className="w-fit">
                  {open.active ? whenLabel(daysLeft(open.next_due_date)) : "Disattivata"}
                </Badge>
                <DialogTitle className="text-lg">{open.name}</DialogTitle>
                <DialogDescription>
                  {RENEWAL_TYPE[open.type]} · {open.client ? <Link className="hover:underline" href={`/clienti/${open.client.id}?scheda=scadenze`}>{open.client.name}</Link> : "Interno Omnira"}
                  {open.project && <> · <Link className="hover:underline" href={`/progetti/${open.project.id}`}>{open.project.code}</Link></>}
                </DialogDescription>
              </DialogHeader>
              {editing && canManage ? (
                <RenewalForm action={updateRenewalAction.bind(null, open.id)} clients={clients} projects={projects} defaults={open} submitLabel="Salva modifiche" onDone={() => setEditing(false)} />
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-[13px]">
                    <Info label="Scadenza" value={formatDate(open.next_due_date)} />
                    <Info label="Frequenza" value={RENEWAL_FREQUENCY[open.frequency]!.label} />
                    <Info label="Fornitore" value={open.provider ?? "—"} />
                    <Info label="Avviso" value={`${open.notify_days_before} giorni prima`} />
                    <Info label="Costo per noi" value={open.cost_cents != null ? formatEuro(open.cost_cents) : "—"} />
                    <Info label="Prezzo al cliente" value={open.price_cents != null ? formatEuro(open.price_cents) : "—"} />
                    <Info label="Avviso inviato" value={open.notified_for === open.next_due_date ? "Sì" : "Non ancora"} />
                  </dl>
                  {/* Rinnovo automatico: si attiva/disattiva qui, al volo */}
                  <div className={cn("flex items-start gap-3 rounded-lg border p-3", open.auto_renew && "border-money/40 bg-money/[0.06]")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">Rinnovo automatico</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {open.auto_renew
                          ? "Alla scadenza il gestionale crea da solo l'incasso (e la spesa, se c'è un costo) e passa al periodo successivo. Ti arriva un avviso."
                          : "Alla scadenza ricevi l'avviso e rinnovi tu con il pulsante Rinnova."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={open.auto_renew}
                      aria-label="Rinnovo automatico"
                      disabled={!canManage || busy || !open.active}
                      onClick={() => start(async () => { const x = await setRenewalAutoAction(open.id, !open.auto_renew); if (x.ok) toast.success(x.message); else toast.error(x.error); })}
                      className={cn(
                        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                        open.auto_renew ? "bg-money" : "bg-muted-foreground/30",
                      )}
                    >
                      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", open.auto_renew ? "translate-x-5.5" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {open.notes && <p className="rounded-lg bg-muted/60 p-3 text-[13px] whitespace-pre-wrap">{open.notes}</p>}
                  {canManage && (
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Modifica</Button>
                      {open.active && (
                        <Button size="sm" className="bg-money hover:bg-money/90" onClick={() => { setCreateRec(Boolean(open.client_id && open.price_cents)); setRenewing(open); }}>
                          <RefreshCw /> Rinnova
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => start(async () => { const x = await setRenewalActiveAction(open.id, !open.active); if (x.ok) toast.success(x.message); else toast.error(x.error); })}
                      >
                        {open.active ? "Disattiva (non si rinnova più)" : "Riattiva"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "danger" | "warning" | "success" | "money" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : tone === "success" ? "bg-success" : "bg-money")} aria-hidden />
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular", tone === "danger" && value !== "0" && "text-destructive")}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

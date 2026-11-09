"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleSlash, HandCoins, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExpenseCategory } from "@/lib/database.types";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY, PAYMENT_METHOD, RENEWAL_FREQUENCY } from "@/lib/labels";
import { cn, formatDate, formatEuro, initials } from "@/lib/utils";
import {
  cancelSubscriptionAction,
  createExpenseAction,
  createSubscriptionAction,
  deleteExpenseAction,
  deleteSubscriptionAction,
  setReimbursedAction,
  updateExpenseAction,
  updateSubscriptionAction,
} from "../actions";
import type { ExpenseItem, SubscriptionItem } from "../queries";
import { ExpenseForm, type Person, type ProjectOpt, SubscriptionForm, todayIso } from "./expense-forms";

type Period = "mese" | "anno" | "tutto";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
};
const perMonth = (s: Pick<SubscriptionItem, "amount_cents" | "frequency">) =>
  Math.round((s.amount_cents * RENEWAL_FREQUENCY[s.frequency]!.perYear) / 12);

/** Prefisso data del periodo: "2026-10" (mese), "2026" (anno), "" (tutto) */
function periodPrefix(period: Period, anchor: Date, shift = 0) {
  if (period === "mese") return monthKey(new Date(anchor.getFullYear(), anchor.getMonth() + shift, 1));
  if (period === "anno") return String(anchor.getFullYear() + shift);
  return "";
}

export function SpeseView({
  expenses,
  subscriptions,
  income,
  people,
  projects,
  meId,
  canManage,
  isAdmin,
  showBalance,
}: {
  expenses: ExpenseItem[];
  subscriptions: SubscriptionItem[];
  income: { paid_on: string; amount_cents: number }[];
  people: Person[];
  projects: ProjectOpt[];
  meId: string;
  canManage: boolean;
  isAdmin: boolean;
  showBalance: boolean;
}) {
  const [period, setPeriod] = React.useState<Period>("tutto");
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [person, setPerson] = React.useState<string>("tutti");
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState<"spesa" | "abbonamento" | null>(null);
  const [openSubId, setOpenSubId] = React.useState<string | null>(null);

  const prefix = periodPrefix(period, anchor);
  const prevPrefix = periodPrefix(period, anchor, -1);
  const byPerson = (e: ExpenseItem) => person === "tutti" || e.paid_by === person;
  const inPeriod = expenses.filter((e) => e.spent_on.startsWith(prefix) && byPerson(e));
  const q = query.trim().toLowerCase();
  const shown = inPeriod.filter(
    (e) =>
      (!category || e.category === category) &&
      (!q || `${e.description} ${e.supplier ?? ""} ${e.project?.name ?? ""}`.toLowerCase().includes(q)),
  );

  const total = inPeriod.reduce((s, e) => s + e.amount_cents, 0);
  const prevTotal = period === "tutto" ? 0 : expenses.filter((e) => e.spent_on.startsWith(prevPrefix) && byPerson(e)).reduce((s, e) => s + e.amount_cents, 0);
  const allInPeriod = expenses.filter((e) => e.spent_on.startsWith(prefix)).reduce((s, e) => s + e.amount_cents, 0);
  const incomeInPeriod = income.filter((p) => p.paid_on.startsWith(prefix)).reduce((s, p) => s + p.amount_cents, 0);
  const activeSubs = subscriptions.filter((s) => s.active && (person === "tutti" || s.paid_by === person));
  const subsMonthly = activeSubs.reduce((s, x) => s + perMonth(x), 0);
  const toReimburse = expenses.filter((e) => e.paid_with === "personale" && !e.reimbursed_on && byPerson(e));
  const toReimburseCents = toReimburse.reduce((s, e) => s + e.amount_cents, 0);

  // Ripartizioni del periodo
  const catTotals = EXPENSE_CATEGORIES.map((c) => ({ ...c, cents: inPeriod.filter((e) => e.category === c.value).reduce((s, e) => s + e.amount_cents, 0) }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const peopleTotals = people
    .map((p) => ({ ...p, cents: expenses.filter((e) => e.spent_on.startsWith(prefix) && e.paid_by === p.id).reduce((s, e) => s + e.amount_cents, 0) }))
    .filter((p) => p.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  // Elenco raggruppato per mese
  const groups = new Map<string, ExpenseItem[]>();
  for (const e of shown) {
    const k = e.spent_on.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  const periodLabel = period === "mese" ? monthLabel(prefix) : period === "anno" ? `Anno ${prefix}` : "Tutto il periodo";
  const move = (dir: number) =>
    setAnchor((a) => (period === "mese" ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getFullYear() + dir, a.getMonth(), 1)));
  const isCurrent = prefix === periodPrefix(period, new Date());
  // Il periodo in corso non è confrontabile con uno intero: niente percentuale
  const delta = prevTotal && !isCurrent ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const openSub = subscriptions.find((s) => s.id === openSubId) ?? null;
  const showPeople = canManage && people.length > 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Periodo, persone, azioni */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Periodo">
          {(["tutto", "mese", "anno"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground capitalize hover:text-foreground", period === p && "bg-muted text-foreground")}
            >
              {p}
            </button>
          ))}
        </div>
        {period !== "tutto" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Periodo precedente" onClick={() => move(-1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center text-[13px] font-semibold first-letter:uppercase">{periodLabel}</span>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Periodo successivo" onClick={() => move(1)}>
              <ChevronRight />
            </Button>
          </div>
        )}
        {showPeople && (
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Persona">
            {[{ id: "tutti", full_name: "Tutti" }, ...people].map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={person === p.id}
                onClick={() => setPerson(p.id)}
                className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", person === p.id && "bg-money/12 text-money-ink")}
              >
                {p.id === meId ? "Le mie" : p.full_name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreating("abbonamento")}>
            <Repeat /> Nuovo abbonamento
          </Button>
          <Button size="sm" className="bg-money hover:bg-money/90" onClick={() => setCreating("spesa")}>
            <Plus /> Nuova spesa
          </Button>
        </div>
      </div>

      {/* Numeri chiave */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`Spese · ${period === "mese" ? monthLabel(prefix) : periodLabel.toLowerCase()}`}
          value={formatEuro(total)}
          tone="danger"
          sub={delta === null ? `${inPeriod.length} movimenti${isCurrent && period !== "tutto" ? " · periodo in corso" : ""}` : `${delta > 0 ? "+" : ""}${delta}% rispetto al ${period === "mese" ? "mese" : "anno"} prima`}
        />
        {showBalance ? (
          <Stat
            label="Saldo del periodo"
            value={formatEuro(incomeInPeriod - allInPeriod)}
            tone={incomeInPeriod - allInPeriod >= 0 ? "success" : "danger"}
            sub={`incassato ${formatEuro(incomeInPeriod)} − spese ${formatEuro(allInPeriod)}`}
          />
        ) : (
          <Stat label="Movimenti" value={String(inPeriod.length)} sub="nel periodo" />
        )}
        <Stat label="Abbonamenti attivi" value={`${formatEuro(subsMonthly)}/mese`} tone="primary" sub={`${activeSubs.length} attivi · ${formatEuro(subsMonthly * 12)} l'anno`} />
        <Stat
          label="Da rimborsare"
          value={formatEuro(toReimburseCents)}
          tone="warning"
          sub={toReimburse.length ? `${toReimburse.length} spese pagate di tasca propria` : "nessun rimborso in sospeso"}
        />
      </div>

      <Tabs defaultValue="movimenti">
        <TabsList>
          <TabsTrigger value="movimenti">Movimenti ({inPeriod.length})</TabsTrigger>
          <TabsTrigger value="abbonamenti">Abbonamenti ({subscriptions.filter((s) => s.active).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movimenti" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca descrizione, fornitore, progetto…" className="h-8 max-w-xs" aria-label="Cerca spese" />
                {category && (
                  <button type="button" onClick={() => setCategory(null)} className="flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium">
                    <span className={cn("size-2 rounded-full", EXPENSE_CATEGORY[category].color)} /> {EXPENSE_CATEGORY[category].label} ✕
                  </button>
                )}
              </div>
              {shown.length === 0 ? (
                <EmptyState
                  area="money"
                  icon={HandCoins}
                  title={inPeriod.length ? "Nessuna spesa con questi filtri" : "Nessuna spesa in questo periodo"}
                  description={inPeriod.length ? "Togli un filtro o cambia ricerca." : "Registra una spesa o aggiungi un abbonamento: gli addebiti si sommano da soli."}
                  className="py-10"
                />
              ) : (
                [...groups.entries()].map(([k, list]) => (
                  <section key={k}>
                    {period !== "mese" && (
                      <h3 className="mb-2 flex items-baseline justify-between text-[13px] font-semibold first-letter:uppercase">
                        <span className="first-letter:uppercase">{monthLabel(k)}</span>
                        <span className="text-muted-foreground tabular">{formatEuro(list.reduce((s, e) => s + e.amount_cents, 0))}</span>
                      </h3>
                    )}
                    <ExpenseList
                      items={list}
                      people={people}
                      projects={projects}
                      meId={meId}
                      canManage={canManage}
                      isAdmin={isAdmin}
                      showPerson={showPeople}
                      onOpenSubscription={setOpenSubId}
                    />
                  </section>
                ))
              )}
            </div>

            <aside className="flex flex-col gap-5">
              <Breakdown
                title="Per categoria"
                rows={catTotals.map((c) => ({ key: c.value, label: c.label, cents: c.cents, color: c.color, active: category === c.value }))}
                onPick={(k) => setCategory((cur) => (cur === k ? null : (k as ExpenseCategory)))}
                hint="Clic su una categoria per filtrare"
              />
              {showPeople && (
                <Breakdown
                  title="Chi ha speso"
                  rows={peopleTotals.map((p) => ({ key: p.id, label: p.id === meId ? `${p.full_name} (tu)` : p.full_name, cents: p.cents, color: "bg-money", active: person === p.id }))}
                  onPick={(k) => setPerson((cur) => (cur === k ? "tutti" : k))}
                />
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="abbonamenti" className="pt-4">
          {subscriptions.length === 0 ? (
            <EmptyState
              area="money"
              icon={Repeat}
              title="Nessun abbonamento"
              description="Aggiungi Claude, Lovable, Google Workspace…: ogni addebito diventa una spesa da solo, anche quelli già passati."
              className="py-10"
            />
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {subscriptions.map((s) => {
                const cat = EXPENSE_CATEGORY[s.category];
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSubId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-l-4 bg-card p-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                        s.active ? "border-l-money" : "border-l-muted-foreground/30 opacity-70",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-money/10 text-money-ink">
                        <Repeat className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{s.name}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <span className={cn("size-2 shrink-0 rounded-full", cat.color)} />
                          {s.supplier ?? cat.label} · {s.active ? `prossimo ${formatDate(s.next_charge_date)}` : `disdetto${s.end_date ? ` il ${formatDate(s.end_date)}` : ""}`}
                        </span>
                        <span className="block text-[11px] text-muted-foreground tabular">
                          {s.charges_count} addebiti · {formatEuro(s.totalCents)} finora{s.person && showPeople ? ` · ${s.person.full_name.split(" ")[0]}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[13px] font-semibold tabular">{formatEuro(s.amount_cents)}</span>
                        <span className="block text-[11px] text-muted-foreground">{RENEWAL_FREQUENCY[s.frequency]!.label.toLowerCase()}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Nuova spesa / abbonamento */}
      <Dialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating === "abbonamento" ? "Nuovo abbonamento" : "Nuova spesa"}</DialogTitle>
            <DialogDescription>
              {creating === "abbonamento"
                ? "Ogni addebito diventa una spesa automaticamente, alla data giusta."
                : "Una spesa singola: un acquisto, una trasferta, un collaboratore."}
            </DialogDescription>
          </DialogHeader>
          {creating === "abbonamento" ? (
            <SubscriptionForm action={createSubscriptionAction} people={people} canChoosePerson={showPeople} meId={meId} submitLabel="Aggiungi abbonamento" onDone={() => setCreating(null)} />
          ) : (
            <ExpenseForm action={createExpenseAction} people={people} projects={projects} canChoosePerson={showPeople} meId={meId} submitLabel="Registra spesa" onDone={() => setCreating(null)} />
          )}
        </DialogContent>
      </Dialog>

      <SubscriptionDetail
        sub={openSub}
        onClose={() => setOpenSubId(null)}
        people={people}
        meId={meId}
        canChoosePerson={showPeople}
        isAdmin={isAdmin}
        recent={openSub ? expenses.filter((e) => e.subscription_id === openSub.id).slice(0, 12) : []}
      />
    </div>
  );
}

/** Elenco spese con dettaglio/modifica: usato in /spese e nella scheda progetto */
export function ExpenseList({
  items,
  people,
  projects,
  meId,
  canManage,
  isAdmin,
  showPerson,
  showProject = true,
  onOpenSubscription,
}: {
  items: ExpenseItem[];
  people: Person[];
  projects: ProjectOpt[];
  meId: string;
  canManage: boolean;
  isAdmin: boolean;
  showPerson: boolean;
  showProject?: boolean;
  onOpenSubscription?: (id: string) => void;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [, start] = React.useTransition();
  const open = items.find((e) => e.id === openId) ?? null;
  const canEdit = (e: ExpenseItem) => canManage || (e.paid_by === meId && !e.reimbursed_on);
  const run = (p: Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.error);
    });

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {items.map((e) => {
          const cat = EXPENSE_CATEGORY[e.category];
          return (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50">
                <span className="w-11 shrink-0 text-center text-[11px] leading-tight text-muted-foreground tabular">
                  <span className="block text-[15px] font-semibold text-foreground">{e.spent_on.slice(8, 10)}</span>
                  {new Date(e.spent_on).toLocaleDateString("it-IT", { month: "short" })}
                </span>
                <span className={cn("size-2.5 shrink-0 rounded-full", cat.color)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                    {e.subscription_id && <Repeat className="size-3.5 shrink-0 text-money-ink" aria-label="Abbonamento" />}
                    {e.description}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[e.supplier, cat.label, showProject && e.project ? `${e.project.code} ${e.project.name}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {e.paid_with === "personale" &&
                  (e.reimbursed_on ? (
                    <Badge tone="success" className="hidden sm:inline-flex">Rimborsata</Badge>
                  ) : (
                    <Badge dot tone="warning" className="hidden sm:inline-flex">Da rimborsare</Badge>
                  ))}
                {showPerson && e.person && (
                  <span title={e.person.full_name} className="flex size-6 shrink-0 items-center justify-center rounded-full bg-money/12 text-[10px] font-semibold text-money-ink">
                    {initials(e.person.full_name)}
                  </span>
                )}
                <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular">{formatEuro(e.amount_cents)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpenId(null); setEditing(false); } }}>
        <DialogContent side="right" className="flex flex-col gap-5 overflow-y-auto">
          {open && (
            <>
              <DialogHeader className="pr-8">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className={cn("size-2.5 rounded-full", EXPENSE_CATEGORY[open.category].color)} /> {EXPENSE_CATEGORY[open.category].label}
                </span>
                <DialogTitle className="text-lg">{open.description}</DialogTitle>
                <DialogDescription>
                  {formatDate(open.spent_on)}
                  {open.supplier ? ` · ${open.supplier}` : ""}
                </DialogDescription>
              </DialogHeader>
              <p className="text-3xl font-semibold tabular">{formatEuro(open.amount_cents)}</p>
              <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
                <dt className="text-muted-foreground">Pagata da</dt>
                <dd>{open.person?.full_name ?? "—"}</dd>
                <dt className="text-muted-foreground">Con</dt>
                <dd>{open.paid_with === "personale" ? "Di tasca propria" : "Conto/carta aziendale"} · {PAYMENT_METHOD[open.method]}</dd>
                {open.project && (
                  <>
                    <dt className="text-muted-foreground">Progetto</dt>
                    <dd><Link href={`/progetti/${open.project.id}?scheda=pagamenti`} className="hover:underline">{open.project.code} {open.project.name}</Link></dd>
                  </>
                )}
                {open.subscription && (
                  <>
                    <dt className="text-muted-foreground">Abbonamento</dt>
                    <dd>
                      {onOpenSubscription ? (
                        <button type="button" className="text-left hover:underline" onClick={() => { setOpenId(null); onOpenSubscription(open.subscription!.id); }}>
                          {open.subscription.name} ({RENEWAL_FREQUENCY[open.subscription.frequency]!.label.toLowerCase()})
                        </button>
                      ) : open.subscription.name}
                    </dd>
                  </>
                )}
              </dl>

              {open.paid_with === "personale" && (
                <div className={cn("flex items-center gap-3 rounded-lg p-3 text-[13px]", open.reimbursed_on ? "bg-success/10 text-success" : "bg-warning/15 text-sales-ink")}>
                  <HandCoins className="size-4 shrink-0" />
                  <span className="flex-1 font-medium">
                    {open.reimbursed_on ? `Rimborsata il ${formatDate(open.reimbursed_on)}` : `Da rimborsare a ${open.person?.full_name ?? "chi l'ha pagata"}`}
                  </span>
                  {canManage &&
                    (open.reimbursed_on ? (
                      <Button size="sm" variant="ghost" onClick={() => run(setReimbursedAction(open.id, false))}>
                        <Undo2 /> Annulla
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-success text-white hover:bg-success/90" onClick={() => run(setReimbursedAction(open.id, true))}>
                        Segna rimborsata
                      </Button>
                    ))}
                </div>
              )}

              {open.notes && <p className="rounded-lg bg-muted/60 p-3 text-[13px] whitespace-pre-wrap">{open.notes}</p>}

              {canEdit(open) && (
                <section className="border-t pt-4">
                  {editing ? (
                    <ExpenseForm
                      action={updateExpenseAction.bind(null, open.id)}
                      people={people}
                      projects={projects}
                      canChoosePerson={canManage && people.length > 1}
                      meId={meId}
                      defaults={open}
                      submitLabel="Salva modifiche"
                      onDone={() => setEditing(false)}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Modifica</Button>
                      {(isAdmin || canManage || open.paid_by === meId) && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => run(deleteExpenseAction(open.id), () => setOpenId(null))}>
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
    </>
  );
}

function SubscriptionDetail({
  sub,
  onClose,
  people,
  meId,
  canChoosePerson,
  isAdmin,
  recent,
}: {
  sub: SubscriptionItem | null;
  onClose: () => void;
  people: Person[];
  meId: string;
  canChoosePerson: boolean;
  isAdmin: boolean;
  recent: ExpenseItem[];
}) {
  const [editing, setEditing] = React.useState(false);
  const [cancelDate, setCancelDate] = React.useState(todayIso());
  const [, start] = React.useTransition();
  const run = (p: Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.error);
    });

  return (
    <Dialog open={!!sub} onOpenChange={(o) => { if (!o) { onClose(); setEditing(false); } }}>
      <DialogContent side="right" className="flex flex-col gap-5 overflow-y-auto">
        {sub && (
          <>
            <DialogHeader className="pr-8">
              <Badge dot tone={sub.active ? "success" : "neutral"} className="w-fit">{sub.active ? "Attivo" : "Disdetto"}</Badge>
              <DialogTitle className="text-lg">{sub.name}</DialogTitle>
              <DialogDescription>
                {sub.supplier ? `${sub.supplier} · ` : ""}
                {EXPENSE_CATEGORY[sub.category].label}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label={RENEWAL_FREQUENCY[sub.frequency]!.label} value={formatEuro(sub.amount_cents)} />
              <Mini label="Al mese circa" value={formatEuro(perMonth(sub))} />
              <Mini label={`Speso (${sub.charges_count})`} value={formatEuro(sub.totalCents)} />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Iniziato il {formatDate(sub.start_date)}
              {sub.active ? ` · prossimo addebito ${formatDate(sub.next_charge_date)}` : sub.end_date ? ` · terminato il ${formatDate(sub.end_date)}` : ""}
              {sub.person ? ` · paga ${sub.person.full_name}` : ""}
            </p>

            {recent.length > 0 && (
              <section>
                <p className="mb-2 text-[13px] font-semibold">Ultimi addebiti registrati</p>
                <ul className="divide-y rounded-lg border text-[13px]">
                  {recent.map((e) => (
                    <li key={e.id} className="flex justify-between px-3 py-1.5">
                      <span className="text-muted-foreground tabular">{formatDate(e.spent_on)}</span>
                      <span className="font-medium tabular">{formatEuro(e.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-3 border-t pt-4">
              {editing ? (
                <SubscriptionForm
                  action={updateSubscriptionAction.bind(null, sub.id)}
                  people={people}
                  canChoosePerson={canChoosePerson}
                  meId={meId}
                  defaults={sub}
                  lockSchedule={sub.charges_count > 0}
                  submitLabel="Salva modifiche"
                  onDone={() => setEditing(false)}
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Modifica</Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => run(deleteSubscriptionAction(sub.id), onClose)}>
                        <Trash2 /> Elimina
                      </Button>
                    )}
                  </div>
                  {sub.active && (
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.04] p-3">
                      <label className="flex flex-col gap-1 text-xs font-medium" htmlFor="cancel_date">
                        Disdici: nessun addebito dopo il
                        <Input id="cancel_date" type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} className="h-8 w-40" />
                      </label>
                      <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => run(cancelSubscriptionAction(sub.id, cancelDate))}>
                        <CircleSlash /> Disdici
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Breakdown({
  title,
  rows,
  onPick,
  hint,
}: {
  title: string;
  rows: { key: string; label: string; cents: number; color: string; active?: boolean }[];
  onPick?: (key: string) => void;
  hint?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.cents));
  const sum = rows.reduce((s, r) => s + r.cents, 0);
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nessuna spesa nel periodo.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => onPick?.(r.key)} className={cn("w-full rounded-md text-left", r.active && "ring-2 ring-money/40 ring-offset-2 ring-offset-card")}>
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate">{r.label}</span>
                  <span className="shrink-0 font-semibold tabular">
                    {formatEuro(r.cents)} <span className="font-normal text-muted-foreground">{Math.round((r.cents / sum) * 100)}%</span>
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", r.color)} style={{ width: `${(r.cents / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && rows.length > 1 && <p className="mt-3 text-[11px] text-muted-foreground">{hint}</p>}
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "danger" | "primary" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-destructive" : tone === "primary" ? "bg-primary" : "bg-money",
        )}
        aria-hidden
      />
      <p className="truncate text-xs font-medium text-muted-foreground first-letter:uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[15px] font-semibold tabular">{value}</p>
    </div>
  );
}

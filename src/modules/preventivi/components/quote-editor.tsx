"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building2,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Plus,
  Printer,
  Repeat,
  Save,
  Tags,
  Send,
  Target,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectType, RenewalFrequency } from "@/lib/database.types";
import { PROJECT_TYPE, QUOTE_STATE, QUOTE_UNITS, RENEWAL_FREQUENCY } from "@/lib/labels";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import {
  acceptQuoteAction,
  backToDraftAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  markSentAction,
  refuseQuoteAction,
  saveQuoteAction,
  type QuotePayload,
} from "../actions";
import type { QuoteDetail } from "../queries";
import type { ServiceItem } from "@/modules/listino/queries";
import { priceLabel } from "@/modules/listino/components/price-list";
import { SERVICE_CATEGORIES } from "@/lib/labels";
import { displayState, euroField, lineTotal, parseEuro, quoteTotals } from "../totals";

type ItemDraft = {
  key: string;
  description: string;
  details: string;
  showDetails: boolean;
  quantity: string;
  unit: string;
  price: string;
  frequency: RenewalFrequency | null;
};

const newKey = () => Math.random().toString(36).slice(2);
const qtyField = (n: number) => String(Number(n)).replace(".", ",");
const parseQty = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function guessProjectType(title: string): ProjectType {
  const t = title.toLowerCase();
  if (/e-?commerce|shop/.test(t)) return "ecommerce";
  if (/gestional/.test(t)) return "gestionale";
  if (/\bapp\b/.test(t)) return "app";
  if (/seo/.test(t)) return "seo";
  if (/\bai\b|automazion|chatbot|assistente/.test(t)) return "automazione_ai";
  if (/sito|landing|web/.test(t)) return "sito";
  if (/software/.test(t)) return "software";
  return "altro";
}

export function QuoteEditor({
  quote,
  services,
  canAccept,
  canCreateProject,
  isAdmin,
}: {
  quote: QuoteDetail;
  services: ServiceItem[];
  canAccept: boolean;
  canCreateProject: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const state = displayState(quote);
  const closed = quote.status === "accettato" || quote.status === "rifiutato";

  const initial = React.useMemo(
    () => ({
      title: quote.title,
      issue_date: quote.issue_date,
      valid_until: quote.valid_until,
      intro: quote.intro ?? "",
      terms: quote.terms ?? "",
      vat: String(Number(quote.vat_rate)).replace(".", ","),
      discount: quote.discount_cents ? euroField(quote.discount_cents) : "",
      deposit: String(quote.deposit_pct),
      items: quote.items.map<ItemDraft>((i) => ({
        key: i.id,
        description: i.description,
        details: i.details ?? "",
        showDetails: !!i.details,
        quantity: qtyField(i.quantity),
        unit: i.unit,
        price: euroField(i.unit_price_cents),
        frequency: i.frequency,
      })),
    }),
    [quote],
  );
  const [form, setForm] = React.useState(initial);
  // Dopo un salvataggio i dati del server ripartono come base del modulo
  const [base, setBase] = React.useState(initial);
  if (base !== initial) {
    setBase(initial);
    setForm(initial);
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (key: string, patch: Partial<ItemDraft>) => setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const move = (idx: number, dir: -1 | 1) =>
    setForm((f) => {
      const items = [...f.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return f;
      [items[idx], items[j]] = [items[j]!, items[idx]!];
      return { ...f, items };
    });
  const addItem = (recurring = false) =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { key: newKey(), description: "", details: "", showDetails: false, quantity: "1", unit: recurring ? "anno" : "pz", price: "", frequency: recurring ? "annuale" : null },
      ],
    }));

  const addFromList = (sv: ServiceItem) =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items.filter((i) => i.description.trim() || i.price.trim()), // via le righe vuote
        {
          key: newKey(),
          description: sv.name,
          details: sv.description ?? "",
          showDetails: !!sv.description,
          quantity: "1",
          unit: sv.unit,
          price: sv.price_cents != null ? euroField(sv.price_cents) : "",
          frequency: sv.frequency,
        },
      ],
    }));
  const [picking, setPicking] = React.useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const [pending, start] = React.useTransition();
  const [accepting, setAccepting] = React.useState(false);
  const [refusing, setRefusing] = React.useState(false);

  // Numeri per i totali (le voci con prezzo non valido contano zero finché non le correggi)
  const numericItems = form.items.map((i) => ({
    quantity: parseQty(i.quantity) ?? 0,
    unit_price_cents: parseEuro(i.price) ?? 0,
    frequency: i.frequency,
  }));
  const vatRate = Number(form.vat.replace(",", ".")) || 0;
  const discountCents = parseEuro(form.discount) ?? 0;
  const depositPct = Math.min(100, Math.max(0, Math.round(Number(form.deposit) || 0)));
  const t = quoteTotals(numericItems, discountCents, vatRate);
  const deposit = Math.round((t.total * depositPct) / 100);

  function buildPayload(): QuotePayload | string {
    const items: QuotePayload["items"] = [];
    for (const [n, i] of form.items.entries()) {
      if (!i.description.trim() && !i.price.trim()) continue; // riga vuota: la ignoro
      const qty = parseQty(i.quantity);
      const price = parseEuro(i.price);
      if (!i.description.trim()) return `Voce ${n + 1}: manca la descrizione`;
      if (qty === null) return `Voce ${n + 1}: quantità non valida`;
      if (price === null) return `Voce ${n + 1}: prezzo non valido`;
      items.push({ description: i.description, details: i.details || null, quantity: qty, unit: i.unit, unit_price_cents: price, frequency: i.frequency });
    }
    if (parseEuro(form.discount) === null) return "Sconto non valido";
    return {
      title: form.title,
      issue_date: form.issue_date,
      valid_until: form.valid_until,
      intro: form.intro || null,
      terms: form.terms || null,
      vat_rate: vatRate,
      discount_cents: discountCents,
      deposit_pct: depositPct,
      items,
    };
  }

  async function save(silent = false) {
    const payload = buildPayload();
    if (typeof payload === "string") {
      toast.error(payload);
      return false;
    }
    const r = await saveQuoteAction(quote.id, payload);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    if (!silent) toast.success(r.message);
    router.refresh();
    return true;
  }

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      if (dirty && !closed && !(await save(true))) return;
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });

  // Ctrl/Cmd + S salva
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !closed) {
        e.preventDefault();
        start(async () => void (await save()));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const recipientName = quote.client?.name ?? quote.lead?.company_name ?? quote.lead?.title ?? "—";

  return (
    <div className="flex flex-col gap-5">
      {/* Barra azioni */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <Badge dot tone={QUOTE_STATE[state].tone}>{QUOTE_STATE[state].label}</Badge>
        {dirty && !closed && <span className="text-xs font-medium text-sales-ink">Modifiche non salvate</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/stampa/preventivo/${quote.id}`} target="_blank">
              <Printer /> Anteprima e PDF
            </Link>
          </Button>
          {!closed && (
            <>
              {quote.status === "bozza" ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => markSentAction(quote.id))}>
                  <Send /> Segna come inviato
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => backToDraftAction(quote.id))}>
                  <Undo2 /> Torna in bozza
                </Button>
              )}
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={pending} onClick={() => setRefusing(true)}>
                <XCircle /> Rifiutato
              </Button>
              {canAccept && (
                <Button size="sm" className="bg-success text-white hover:bg-success/90" disabled={pending} onClick={() => setAccepting(true)}>
                  <CheckCircle2 /> Accettato
                </Button>
              )}
              <Button size="sm" disabled={pending || !dirty} onClick={() => start(async () => void (await save()))}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Salva
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await duplicateQuoteAction(quote.id);
                if (r.ok && r.data) {
                  toast.success(r.message);
                  router.push(`/preventivi/${r.data.id}`);
                } else if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Copy /> Duplica
          </Button>
          {(quote.status === "bozza" || isAdmin) && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Elimina preventivo"
              className="text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteQuoteAction(quote.id);
                  if (r.ok) {
                    toast.success(r.message);
                    router.push("/preventivi");
                  } else toast.error(r.error);
                })
              }
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {/* Esito */}
      {quote.status === "accettato" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/[0.07] p-4 text-[13px]">
          <CheckCircle2 className="size-5 text-success" />
          <span className="font-medium">Accettato il {formatDate(quote.decided_at)}</span>
          {quote.project && (
            <Link href={`/progetti/${quote.project.id}?scheda=pagamenti`} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
              <Briefcase className="size-4" /> {quote.project.code} {quote.project.name}
            </Link>
          )}
          <span className="text-muted-foreground">Per cambiare qualcosa duplica il preventivo.</span>
        </div>
      )}
      {quote.status === "rifiutato" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.05] p-4 text-[13px]">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <XCircle className="size-4" /> Rifiutato il {formatDate(quote.decided_at)}
          </p>
          {quote.refused_reason && <p className="mt-1 text-muted-foreground">Motivo: {quote.refused_reason}</p>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Dati */}
          <Section title="Dati del preventivo">
            <div className="grid gap-4 sm:grid-cols-[1fr_150px_150px]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qe_title">Titolo</Label>
                <Input id="qe_title" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={closed} className="font-semibold" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qe_date">Data</Label>
                <Input id="qe_date" type="date" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} disabled={closed} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qe_valid">Valido fino al</Label>
                <Input id="qe_valid" type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} disabled={closed} />
              </div>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Per:</span>
              {quote.client ? (
                <Link href={`/clienti/${quote.client.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                  <Building2 className="size-3.5 text-sales-ink" /> {quote.client.name}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 font-medium">
                  <Target className="size-3.5 text-sales-ink" /> {recipientName}
                  <span className="rounded bg-sales/20 px-1 text-[10px] font-semibold text-sales-ink">LEAD</span>
                </span>
              )}
              {quote.lead && (
                <Link href={`/lead?aperto=${quote.lead.id}`} className="text-xs text-muted-foreground hover:underline">
                  (lead: {quote.lead.title})
                </Link>
              )}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qe_intro">Premessa</Label>
              <Textarea
                id="qe_intro"
                rows={3}
                value={form.intro}
                onChange={(e) => set("intro", e.target.value)}
                disabled={closed}
                placeholder="Cosa proponete e perché: obiettivi del cliente, soluzione, risultato atteso."
              />
            </div>
          </Section>

          {/* Voci */}
          <Section title="Voci" subtitle="Prezzi IVA esclusa. I canoni ricorrenti sono separati dal totale una tantum.">
            <ul className="flex flex-col gap-2">
              {form.items.map((it, idx) => {
                const total = lineTotal({ quantity: parseQty(it.quantity) ?? 0, unit_price_cents: parseEuro(it.price) ?? 0 });
                const badPrice = it.price.trim() !== "" && parseEuro(it.price) === null;
                return (
                  <li key={it.key} className={cn("rounded-lg border p-2.5", it.frequency ? "border-money/30 bg-money/[0.04]" : "bg-card")}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular">{idx + 1}</span>
                      <Input
                        aria-label={`Descrizione voce ${idx + 1}`}
                        value={it.description}
                        onChange={(e) => setItem(it.key, { description: e.target.value })}
                        placeholder="Es. Sviluppo sito 5 pagine"
                        disabled={closed}
                        className="h-8 flex-1 font-medium"
                      />
                      <span className="w-28 shrink-0 text-right text-[14px] font-semibold tabular">{formatEuro(total)}</span>
                      {!closed && (
                        <span className="flex shrink-0 gap-0.5">
                          <IconBtn label="Su" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp /></IconBtn>
                          <IconBtn label="Giù" onClick={() => move(idx, 1)} disabled={idx === form.items.length - 1}><ArrowDown /></IconBtn>
                          <IconBtn label="Elimina voce" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((x) => x.key !== it.key) }))} danger>
                            <Trash2 />
                          </IconBtn>
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-7 sm:grid-cols-[90px_110px_130px_minmax(0,190px)] sm:items-center">
                      <MiniField label="Q.tà">
                        <Input aria-label="Quantità" value={it.quantity} onChange={(e) => setItem(it.key, { quantity: e.target.value })} inputMode="decimal" disabled={closed} className="h-8 tabular" />
                      </MiniField>
                      <MiniField label="Unità">
                        <Select value={it.unit} onValueChange={(v) => setItem(it.key, { unit: v })} disabled={closed}>
                          <SelectTrigger aria-label="Unità" className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUOTE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </MiniField>
                      <MiniField label="Prezzo €">
                        <Input
                          aria-label="Prezzo unitario"
                          value={it.price}
                          onChange={(e) => setItem(it.key, { price: e.target.value })}
                          onBlur={() => {
                            const c = parseEuro(it.price);
                            if (c !== null && it.price.trim()) setItem(it.key, { price: euroField(c) });
                          }}
                          inputMode="decimal"
                          placeholder="0,00"
                          disabled={closed}
                          aria-invalid={badPrice || undefined}
                          className="h-8 text-right tabular"
                        />
                      </MiniField>
                      <MiniField label="Tipo">
                        <Select value={it.frequency ?? "una_tantum"} onValueChange={(v) => setItem(it.key, { frequency: v === "una_tantum" ? null : (v as RenewalFrequency) })} disabled={closed}>
                          <SelectTrigger aria-label="Tipo" className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="una_tantum">Una tantum</SelectItem>
                            {Object.entries(RENEWAL_FREQUENCY).map(([v, f]) => <SelectItem key={v} value={v}>Canone {f.label.toLowerCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </MiniField>
                    </div>
                    {it.showDetails ? (
                      <Textarea
                        aria-label="Dettagli della voce"
                        rows={2}
                        value={it.details}
                        onChange={(e) => setItem(it.key, { details: e.target.value })}
                        placeholder="Cosa comprende: pagine, funzioni, revisioni incluse…"
                        disabled={closed}
                        className="mt-2 ml-7 w-[calc(100%-1.75rem)] text-[13px]"
                      />
                    ) : (
                      !closed && (
                        <button type="button" className="mt-1.5 ml-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setItem(it.key, { showDetails: true })}>
                          + aggiungi dettagli
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
            {form.items.length === 0 && <p className="text-[13px] text-muted-foreground">Nessuna voce: aggiungi la prima.</p>}
            {!closed && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-sales text-on-warning hover:bg-sales/90" onClick={() => setPicking(true)}>
                  <Tags /> Aggiungi dal listino
                </Button>
                <Button variant="outline" size="sm" onClick={() => addItem(false)}>
                  <Plus /> Aggiungi voce
                </Button>
                <Button variant="outline" size="sm" onClick={() => addItem(true)}>
                  <Repeat /> Aggiungi canone ricorrente
                </Button>
              </div>
            )}
          </Section>

          {/* Condizioni */}
          <Section title="Condizioni">
            <Textarea
              rows={4}
              value={form.terms}
              onChange={(e) => set("terms", e.target.value)}
              disabled={closed}
              aria-label="Condizioni"
              placeholder="Tempi, revisioni incluse, cosa è escluso, modalità di consegna…"
            />
          </Section>
        </div>

        {/* Totali */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-16 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-[oklch(0.62_0.145_68)] bg-card shadow-xs">
            <div className="flex items-center gap-2 bg-gradient-to-r from-[oklch(0.58_0.14_62)] to-[oklch(0.66_0.15_75)] px-4 py-2.5 text-[14px] font-semibold text-white">
              <FileText className="size-4" /> {quote.number}
            </div>
            <dl className="flex flex-col gap-2 p-4 text-[13px]">
              <Row label="Imponibile" value={formatEuro(t.oneOff)} />
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Sconto €</dt>
                <dd>
                  <Input value={form.discount} onChange={(e) => set("discount", e.target.value)} placeholder="0,00" inputMode="decimal" disabled={closed} className="h-7 w-28 text-right tabular" aria-label="Sconto in euro" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">IVA %</dt>
                <dd>
                  <Input value={form.vat} onChange={(e) => set("vat", e.target.value)} inputMode="decimal" disabled={closed} className="h-7 w-20 text-right tabular" aria-label="Aliquota IVA" />
                </dd>
              </div>
              <Row label={`IVA ${vatRate}%`} value={formatEuro(t.vat)} muted />
              <div className="mt-1 flex items-baseline justify-between border-t pt-3">
                <dt className="font-semibold">Totale</dt>
                <dd className="text-2xl font-semibold tabular">{formatEuro(t.total)}</dd>
              </div>
            </dl>
            <div className="border-t bg-muted/30 p-4 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Acconto all&apos;accettazione</span>
                <span className="flex items-center gap-1">
                  <Input value={form.deposit} onChange={(e) => set("deposit", e.target.value)} inputMode="numeric" disabled={closed} className="h-7 w-14 text-right tabular" aria-label="Acconto in percentuale" />%
                </span>
              </div>
              <p className="mt-2 flex justify-between text-muted-foreground tabular">
                <span>Acconto</span> <span>{formatEuro(depositPct > 0 && depositPct < 100 ? deposit : depositPct === 100 ? t.total : 0)}</span>
              </p>
              <p className="flex justify-between text-muted-foreground tabular">
                <span>Saldo alla consegna</span> <span>{formatEuro(depositPct > 0 && depositPct < 100 ? t.total - deposit : depositPct === 100 ? 0 : t.total)}</span>
              </p>
            </div>
            {t.recurring.length > 0 && (
              <div className="border-t bg-money/[0.05] p-4 text-[13px]">
                <p className="mb-1.5 flex items-center gap-1.5 font-medium text-money-ink">
                  <Repeat className="size-3.5" /> Canoni ricorrenti
                </p>
                {t.recurring.map((r) => (
                  <p key={r.frequency} className="flex justify-between tabular">
                    <span className="text-muted-foreground">{RENEWAL_FREQUENCY[r.frequency]!.label}</span>
                    <span>
                      {formatEuro(r.net)} <span className="text-xs text-muted-foreground">+ IVA</span>
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
          {quote.owner && <p className="px-1 text-xs text-muted-foreground">Preparato da {quote.owner.full_name}{quote.sent_at ? ` · inviato il ${formatDate(quote.sent_at)}` : ""}</p>}
        </aside>
      </div>

      <AcceptDialog
        open={accepting}
        onOpenChange={setAccepting}
        quote={quote}
        totals={{ total: t.total, deposit: depositPct > 0 && depositPct < 100 ? deposit : 0, recurring: t.recurring.length }}
        canCreateProject={canCreateProject}
        pending={pending}
        onConfirm={(opts) =>
          run(
            () => acceptQuoteAction(quote.id, opts),
            () => setAccepting(false),
          )
        }
      />
      <ServicePicker open={picking} onOpenChange={setPicking} services={services} onPick={addFromList} />
      <RefuseDialog open={refusing} onOpenChange={setRefusing} pending={pending} onConfirm={(reason) => run(() => refuseQuoteAction(quote.id, reason), () => setRefusing(false))} />
    </div>
  );
}

function AcceptDialog({
  open,
  onOpenChange,
  quote,
  totals,
  canCreateProject,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quote: QuoteDetail;
  totals: { total: number; deposit: number; recurring: number };
  canCreateProject: boolean;
  pending: boolean;
  onConfirm: (o: { createProject: boolean; projectType: ProjectType; createReceivables: boolean; createRenewals: boolean }) => void;
}) {
  const [createProject, setCreateProject] = React.useState(canCreateProject && !quote.project_id);
  const [projectType, setProjectType] = React.useState<ProjectType>(guessProjectType(quote.title));
  const [createReceivables, setCreateReceivables] = React.useState(true);
  const [createRenewals, setCreateRenewals] = React.useState(true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Il cliente ha accettato?</DialogTitle>
          <DialogDescription>
            {quote.client ? `Preventivo per ${quote.client.name}.` : "Il lead diventa cliente in automatico."} Scegli cosa preparare subito.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          <Check checked={createProject} onChange={setCreateProject} disabled={!canCreateProject || !!quote.project_id} title="Crea il progetto" hint={canCreateProject ? "Con le fasi standard, pronto per i task." : "Solo amministratori e PM possono creare progetti."}>
            {createProject && (
              <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
                <SelectTrigger className="mt-2 h-8 w-56" aria-label="Tipo di progetto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_TYPE).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </Check>
          <Check
            checked={createReceivables}
            onChange={setCreateReceivables}
            title="Aggiungi agli incassi"
            hint={totals.deposit ? `Acconto ${formatEuro(totals.deposit)} subito + saldo ${formatEuro(totals.total - totals.deposit)}` : `${formatEuro(totals.total)} da incassare`}
          />
          {totals.recurring > 0 && (
            <Check checked={createRenewals} onChange={setCreateRenewals} title="Crea le scadenze dei canoni" hint="Con avviso 30 giorni prima di ogni rinnovo." />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button className="bg-success text-white hover:bg-success/90" disabled={pending} onClick={() => onConfirm({ createProject, projectType, createReceivables, createRenewals: totals.recurring > 0 && createRenewals })}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Conferma accettazione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefuseDialog({ open, onOpenChange, pending, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; pending: boolean; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preventivo rifiutato</DialogTitle>
          <DialogDescription>Il motivo resta sul preventivo e sul lead: aiuta a capire cosa migliorare.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Es. prezzo troppo alto, ha scelto un altro fornitore, progetto rimandato" aria-label="Motivo del rifiuto" autoFocus />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => onConfirm(reason)}>
            Segna come rifiutato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Check({
  checked,
  onChange,
  disabled,
  title,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className={cn("flex items-start gap-2.5 rounded-lg border p-3 text-[13px]", checked && !disabled ? "border-success/40 bg-success/[0.05]" : "", disabled && "opacity-60")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--success)]" />
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        {children}
      </span>
    </label>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular", muted ? "text-muted-foreground" : "font-medium")}>{value}</dd>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 [&_svg]:size-3.5", danger && "hover:bg-destructive/10 hover:text-destructive")}
    >
      {children}
    </button>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </label>
  );
}

function ServicePicker({
  open,
  onOpenChange,
  services,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  services: ServiceItem[];
  onPick: (s: ServiceItem) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [added, setAdded] = React.useState<string[]>([]);
  const q = query.trim().toLowerCase();
  const groups = SERVICE_CATEGORIES.map((c) => ({
    ...c,
    items: services.filter((s) => s.category === c.value && (!q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q))),
  })).filter((g) => g.items.length);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setQuery("");
          setAdded([]);
        }
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Aggiungi dal listino</DialogTitle>
          <DialogDescription>Clicca i servizi da inserire: puoi sceglierne più di uno. Prezzi e dettagli restano modificabili.</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un servizio…" aria-label="Cerca nel listino" autoFocus />
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              {services.length ? "Nessun servizio trovato." : "Il listino è vuoto: aggiungi i servizi dalla pagina Listino."}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.value} className="mb-3">
                <p className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.label}</p>
                <ul className="flex flex-col gap-1">
                  {g.items.map((sv) => {
                    const n = added.filter((x) => x === sv.id).length;
                    const price = priceLabel(sv);
                    return (
                      <li key={sv.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onPick(sv);
                            setAdded((a) => [...a, sv.id]);
                          }}
                          className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-sales hover:bg-sales/10", n && "border-success/50 bg-success/[0.06]")}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium">
                              {sv.frequency && <Repeat className="size-3.5 text-money-ink" />}
                              {sv.name}
                            </span>
                            {sv.description && <span className="block truncate text-xs text-muted-foreground">{sv.description}</span>}
                          </span>
                          <span className={cn("shrink-0 text-xs font-semibold tabular", !price && "text-sales-ink")}>{price ?? "da definire"}</span>
                          {n > 0 ? (
                            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-success px-1.5 text-[11px] font-semibold text-white">{n}</span>
                          ) : (
                            <Plus className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{added.length ? `Fatto (${added.length} aggiunt${added.length === 1 ? "a" : "e"})` : "Chiudi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

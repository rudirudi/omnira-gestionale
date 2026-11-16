"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Check, GripVertical, Loader2, Plus, Send, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { saveInvoiceAction, sendInvoiceAction } from "../actions";
import { DOC_TYPES, NATURES, PAYMENT_METHODS, type Line, summary } from "../common";
import type { InvoiceClient, InvoiceDetail, UninvoicedReceivable } from "../queries";

type LineState = { key: string; description: string; quantity: string; price: string; vat_rate: string; vat_nature: string; receivable_id: string | null };
type Project = { id: string; code: string | null; name: string; client_id: string | null };

const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const parseNum = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
// "1.234,56" o "1234.56" → centesimi
const toCents = (s: string) => {
  const t = s.trim().replace(/\s|€/g, "");
  let n: number;
  if (t.includes(",")) n = parseNum(t); // formato italiano: 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) n = Number(t.replace(/\./g, "")); // 1.000 = mille
  else n = Number(t); // 1234.56
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const newKey = () => Math.random().toString(36).slice(2);
const RATES = ["22", "10", "5", "4", "0"];

function missingClientData(c?: InvoiceClient) {
  if (!c) return [];
  const m: string[] = [];
  const it = !c.country || c.country === "IT";
  if (!c.vat_number && !c.tax_code) m.push("partita IVA o codice fiscale");
  if (!c.address || !c.city) m.push("indirizzo");
  if (it && !/^\d{5}$/.test(c.zip ?? "")) m.push("CAP");
  if (it && !c.sdi_code && !c.pec) m.push("codice destinatario o PEC (senza, la fattura va nel suo cassetto fiscale)");
  return m;
}

export function InvoiceEditor({
  invoice,
  clients,
  projects,
  receivables,
  defaultVat,
  regime,
  canManage,
  initial,
  checks = [],
}: {
  checks?: string[];
  invoice?: InvoiceDetail;
  clients: InvoiceClient[];
  projects: Project[];
  receivables: UninvoicedReceivable[];
  defaultVat: number;
  regime: string;
  canManage: boolean;
  initial?: { clientId?: string; receivableIds?: string[]; projectId?: string };
}) {
  const router = useRouter();
  const forfettario = regime === "RF19";
  const baseRate = forfettario ? "0" : String(defaultVat).replace(/\.0+$/, "");
  const baseNature = forfettario ? "N2.2" : "";
  const [grossIncassi, setGrossIncassi] = React.useState(!forfettario);

  const fromReceivable = React.useCallback(
    (r: UninvoicedReceivable, gross: boolean): LineState => {
      const rate = Number(baseRate);
      const net = gross && rate > 0 ? Math.round(r.amount_cents / (1 + rate / 100)) : r.amount_cents;
      return { key: newKey(), description: r.description, quantity: "1", price: euro(net), vat_rate: baseRate, vat_nature: baseNature, receivable_id: r.id };
    },
    [baseRate, baseNature],
  );

  const initialReceivables = receivables.filter((r) => initial?.receivableIds?.includes(r.id));
  const [docType, setDocType] = React.useState(invoice?.doc_type ?? "TD01");
  const [date, setDate] = React.useState(invoice?.date ?? new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = React.useState(invoice?.client_id ?? initial?.clientId ?? initialReceivables[0]?.client_id ?? "");
  const [projectId, setProjectId] = React.useState(invoice?.project_id ?? initial?.projectId ?? initialReceivables[0]?.project_id ?? "");
  const [method, setMethod] = React.useState(invoice?.payment_method ?? "MP05");
  const [due, setDue] = React.useState(invoice?.payment_due ?? initialReceivables[0]?.due_date ?? "");
  const [causale, setCausale] = React.useState(invoice?.causale ?? "");
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");
  const [lines, setLines] = React.useState<LineState[]>(
    invoice
      ? invoice.lines.map((l) => ({
          key: l.id,
          description: l.description,
          quantity: String(Number(l.quantity)).replace(".", ","),
          price: euro(l.unit_price_cents),
          vat_rate: String(Number(l.vat_rate)),
          vat_nature: l.vat_nature ?? "",
          receivable_id: l.receivable_id,
        }))
      : initialReceivables.length
        ? initialReceivables.map((r) => fromReceivable(r, !forfettario))
        : [{ key: newKey(), description: "", quantity: "1", price: "", vat_rate: baseRate, vat_nature: baseNature, receivable_id: null }],
  );
  const [errors, setErrors] = React.useState<string[]>([]);
  const [savedId, setSavedId] = React.useState<string | null>(invoice?.id ?? null);
  const [pending, start] = React.useTransition();
  const [sending, setSending] = React.useState(false);

  const client = clients.find((c) => c.id === clientId);
  const missing = missingClientData(client);
  const clientProjects = projects.filter((p) => !clientId || p.client_id === clientId);
  const available = receivables.filter((r) => r.client_id === clientId && !lines.some((l) => l.receivable_id === r.id));
  const editable = !invoice || ["bozza", "scartata", "errore"].includes(invoice.status);
  const numbered = !!invoice?.number;

  const parsedLines: Line[] = lines.map((l) => ({
    description: l.description,
    quantity: parseNum(l.quantity) || 0,
    unitPriceCents: toCents(l.price) || 0,
    vatRate: Number(l.vat_rate),
    vatNature: Number(l.vat_rate) === 0 ? l.vat_nature || null : null,
  }));
  const tot = summary(parsedLines);

  const patch = (key: string, p: Partial<LineState>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const payload = () => ({
    doc_type: docType,
    date,
    client_id: clientId,
    project_id: projectId || null,
    related_invoice_id: invoice?.related_invoice_id ?? null,
    causale: causale || null,
    notes: notes || null,
    payment_method: method,
    payment_due: due || null,
    lines: lines.map((l) => ({
      description: l.description,
      quantity: parseNum(l.quantity),
      unit_price_cents: toCents(l.price),
      vat_rate: Number(l.vat_rate),
      vat_nature: Number(l.vat_rate) === 0 ? l.vat_nature || null : null,
      receivable_id: l.receivable_id,
    })),
  });

  const validate = () => {
    const e: string[] = [];
    if (!clientId) e.push("Scegli il cliente");
    lines.forEach((l, i) => {
      if (!l.description.trim()) e.push(`Riga ${i + 1}: manca la descrizione`);
      if (!(parseNum(l.quantity) > 0)) e.push(`Riga ${i + 1}: quantità non valida`);
      if (Number.isNaN(toCents(l.price)) || l.price.trim() === "") e.push(`Riga ${i + 1}: prezzo non valido`);
      if (Number(l.vat_rate) === 0 && !l.vat_nature) e.push(`Riga ${i + 1}: senza IVA scegli la natura dell'operazione`);
    });
    setErrors(e);
    return e.length === 0;
  };

  const save = (thenSend: boolean) =>
    start(async () => {
      if (!validate()) return;
      const r = await saveInvoiceAction(savedId, payload());
      if (!r.ok) {
        setErrors([r.error ?? "Errore"]);
        return void toast.error(r.error);
      }
      if (!thenSend) {
        toast.success(r.message);
        if (!savedId) router.replace(`/fatture/${r.data}`);
        else router.refresh();
        return;
      }
      if (!savedId && r.data) setSavedId(r.data);
      setSending(true);
      const s = await sendInvoiceAction(r.data!);
      setSending(false);
      if (!s.ok) {
        setErrors(s.error?.split(" · ") ?? []);
        toast.error("Fattura non inviata: controlla i punti in rosso");
        // la bozza è salvata: la apro (lì i controlli restano visibili)
        if (!invoice) router.replace(`/fatture/${r.data}`);
        else router.refresh();
        return;
      }
      toast.success(s.message);
      router.replace(`/fatture/${r.data}`);
      router.refresh();
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Intestazione */}
        <section className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Documento" htmlFor="f_type">
            <select id="f_type" value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)} disabled={!editable || numbered} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-[13.5px]">
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data" htmlFor="f_date" hint={numbered ? "Con il numero assegnato la data non cambia" : undefined}>
            <Input id="f_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!editable || numbered} />
          </Field>
          <Field label="Cliente *" htmlFor="f_client" className="sm:col-span-2">
            <select
              id="f_client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId("");
                setLines((ls) => ls.filter((l) => !l.receivable_id));
              }}
              disabled={!editable}
              className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-[13.5px]"
            >
              <option value="">Scegli…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {client && (
            <div className={cn("rounded-lg border px-3 py-2 text-[12.5px] sm:col-span-2 lg:col-span-4", missing.length ? "border-warning bg-warning/10" : "bg-muted/40")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span className="font-semibold">{client.legal_name || client.name}</span>
                {client.vat_number && <span>P.IVA {client.vat_number}</span>}
                {client.tax_code && client.tax_code !== client.vat_number && <span>C.F. {client.tax_code}</span>}
                <span className="text-muted-foreground">{[client.address, client.zip, client.city, client.province && `(${client.province})`].filter(Boolean).join(" ")}</span>
                <span className="text-muted-foreground">{client.sdi_code ? `Codice SDI ${client.sdi_code}` : client.pec ? `PEC ${client.pec}` : "Nessun codice SDI"}</span>
                <Link href={`/clienti/${client.id}`} className="ml-auto text-primary hover:underline">
                  Modifica dati cliente
                </Link>
              </div>
              {missing.length > 0 && (
                <p className="mt-1 flex items-center gap-1.5 font-medium text-warning-foreground">
                  <AlertTriangle className="size-3.5" /> Mancano: {missing.join(", ")}
                </p>
              )}
            </div>
          )}
          <Field label="Progetto" htmlFor="f_project">
            <select id="f_project" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!editable} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-[13.5px]">
              <option value="">Nessuno</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pagamento" htmlFor="f_method">
            <select id="f_method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={!editable} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-[13.5px]">
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scadenza pagamento" htmlFor="f_due">
            <Input id="f_due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={!editable} />
          </Field>
          {invoice?.related && (
            <div className="flex flex-col justify-end text-[12.5px]">
              <span className="text-muted-foreground">Storna la fattura</span>
              <Link href={`/fatture/${invoice.related.id}`} className="font-semibold text-primary hover:underline">
                n. {invoice.related.number}/{invoice.related.year} del {formatDate(invoice.related.date)}
              </Link>
            </div>
          )}
          <Field label="Causale" htmlFor="f_causale" hint="Compare nella fattura (es. «Acconto 50% sviluppo e-commerce»)" className="sm:col-span-2 lg:col-span-4">
            <Textarea id="f_causale" value={causale} onChange={(e) => setCausale(e.target.value)} rows={2} maxLength={2000} disabled={!editable} />
          </Field>
        </section>

        {/* Righe */}
        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <h2 className="text-[14px] font-semibold">Righe</h2>
            <span className="text-[12px] text-muted-foreground">Prezzi IVA esclusa</span>
          </div>
          <ul className="flex flex-col divide-y">
            {lines.map((l, i) => {
              const rate = Number(l.vat_rate);
              const net = Math.round((parseNum(l.quantity) || 0) * (toCents(l.price) || 0));
              return (
                <li key={l.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 gap-y-2 px-3 py-3 md:grid-cols-[1.25rem_minmax(0,1fr)_5rem_7.5rem_9rem_6.5rem_2rem] md:items-start">
                  <span className="pt-2 text-center text-[11px] text-muted-foreground tabular">
                    <GripVertical className="mx-auto hidden size-3.5 md:block" aria-hidden />
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Textarea
                      value={l.description}
                      onChange={(e) => patch(l.key, { description: e.target.value })}
                      rows={1}
                      maxLength={1000}
                      placeholder="Descrizione"
                      aria-label={`Descrizione riga ${i + 1}`}
                      disabled={!editable}
                      className="min-h-9 resize-y py-1.5 text-[13.5px] [field-sizing:content]"
                    />
                    {l.receivable_id && (
                      <span className="flex items-center gap-1 text-[11.5px] text-money-ink">
                        <Wallet className="size-3" /> Collegata a un importo da incassare
                      </span>
                    )}
                  </div>
                  <div className="col-start-2 grid grid-cols-[5rem_minmax(0,1fr)_7rem] gap-2 md:contents">
                    <Input value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value })} inputMode="decimal" aria-label="Quantità" disabled={!editable} className="text-right tabular" />
                    <div className="relative">
                      <Input value={l.price} onChange={(e) => patch(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label="Prezzo unitario" disabled={!editable} className="pr-6 text-right tabular" />
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[12px] text-muted-foreground">€</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <select
                        value={l.vat_rate}
                        onChange={(e) => patch(l.key, { vat_rate: e.target.value, vat_nature: e.target.value === "0" ? l.vat_nature || baseNature || "N2.2" : "" })}
                        aria-label="IVA"
                        disabled={!editable}
                        className="h-9 rounded-md border bg-background px-2 text-[13px]"
                      >
                        {[...new Set([...RATES, l.vat_rate])].map((r) => (
                          <option key={r} value={r}>
                            {r === "0" ? "Senza IVA" : `IVA ${r}%`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <span className="col-start-2 self-center text-right text-[13.5px] font-semibold tabular md:col-start-auto md:pt-2">{formatEuro(net)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="col-start-2 justify-self-end text-muted-foreground md:col-start-auto md:mt-1"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    disabled={!editable || lines.length === 1}
                    aria-label={`Elimina riga ${i + 1}`}
                  >
                    <Trash2 />
                  </Button>
                  {rate === 0 && (
                    <select
                      value={l.vat_nature}
                      onChange={(e) => patch(l.key, { vat_nature: e.target.value })}
                      aria-label="Natura dell'operazione senza IVA"
                      disabled={!editable}
                      className={cn("col-start-2 h-8 rounded-md border bg-background px-2 text-[12.5px] md:col-span-5", !l.vat_nature && "border-destructive")}
                    >
                      <option value="">Perché senza IVA? Scegli la natura…</option>
                      {Object.entries(NATURES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          {editable && (
            <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { key: newKey(), description: "", quantity: "1", price: "", vat_rate: baseRate, vat_nature: baseNature, receivable_id: null }])}>
                <Plus /> Aggiungi riga
              </Button>
            </div>
          )}
        </section>

        {/* Importi da incassare del cliente */}
        {editable && clientId && available.length > 0 && (
          <section className="rounded-xl border border-money/30 bg-money/5 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Wallet className="size-4 text-money-ink" />
              <h2 className="text-[14px] font-semibold">Da incassare, non ancora fatturati</h2>
              {!forfettario && (
                <label className="ml-auto flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={grossIncassi} onChange={(e) => setGrossIncassi(e.target.checked)} className="size-4 accent-[var(--color-money)]" />
                  Gli importi sono IVA inclusa
                </label>
              )}
            </div>
            <ul className="flex flex-col gap-1.5">
              {available.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.description}</span>
                  {r.due_date && <span className="text-[12px] text-muted-foreground">entro {formatDate(r.due_date)}</span>}
                  <span className="font-semibold tabular">{formatEuro(r.amount_cents)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setLines((ls) => {
                        const empty = ls.length === 1 && !ls[0].description && !ls[0].price;
                        return [...(empty ? [] : ls), fromReceivable(r, grossIncassi)];
                      })
                    }
                  >
                    <Plus /> Aggiungi
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Field label="Note interne" htmlFor="f_notes" hint="Non vanno in fattura">
          <Textarea id="f_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} disabled={!editable} />
        </Field>
      </div>

      {/* Totali e azioni */}
      <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <dl className="flex flex-col gap-1.5 text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Imponibile</dt>
              <dd className="tabular">{formatEuro(tot.net)}</dd>
            </div>
            {tot.rows.map((r) => (
              <div key={`${r.rate}-${r.nature}`} className="flex justify-between text-[12.5px] text-muted-foreground">
                <dt>{r.rate > 0 ? `IVA ${r.rate}% su ${formatEuro(r.net)}` : `${r.nature ?? "Senza IVA"} su ${formatEuro(r.net)}`}</dt>
                <dd className="tabular">{formatEuro(r.vat)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-2 text-[16px] font-semibold">
              <dt>Totale</dt>
              <dd className="tabular">{formatEuro(tot.total)}</dd>
            </div>
          </dl>
        </div>
        {errors.length > 0 ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
            <p className="mb-1 font-semibold">Da sistemare prima di continuare</p>
            <ul className="list-disc pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : (
          checks.length > 0 &&
          editable && (
            <div className="rounded-xl border border-warning bg-warning/10 px-4 py-3 text-[12.5px]">
              <p className="mb-1 font-semibold text-warning-foreground">Prima dell&apos;invio va sistemato</p>
              <ul className="list-disc pl-4">
                {checks.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )
        )}
        {canManage && editable && (
          <div className="flex flex-col gap-2">
            <Button className="bg-money hover:bg-money/90" onClick={() => save(true)} disabled={pending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Invio allo SDI…" : invoice?.status === "scartata" || invoice?.status === "errore" ? "Salva e reinvia" : "Salva e invia allo SDI"}
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={pending}>
              {pending && !sending ? <Loader2 className="animate-spin" /> : <Check />} Salva bozza
            </Button>
            <p className="text-[11.5px] text-muted-foreground">
              Prima di partire controllo i dati obbligatori. Il numero si assegna all&apos;invio, in ordine di data.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FlaskConical, Printer, Receipt, Send } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { DOC_TYPES, NATURES, PAYMENT_METHODS, summary } from "@/modules/fatture/common";
import { InvoiceSideActions, RefreshButton } from "@/modules/fatture/components/invoice-actions";
import { InvoiceEditor } from "@/modules/fatture/components/invoice-editor";
import { INVOICE_STATUS, invoiceNumber } from "@/modules/fatture/labels";
import { getCompanySettings, getInvoice, listInvoiceClients, listProjectsForInvoices, listUninvoicedReceivables, toCompany, toCustomer } from "@/modules/fatture/queries";
import { checkInvoice } from "@/modules/fatture/xml";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/fatture/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Fattura" };
  const inv = await getInvoice(id);
  return { title: inv ? `Fattura ${invoiceNumber(inv)} ${inv.client?.name ?? ""}` : "Fattura" };
}

type SdiError = { code?: string; description?: string; hint?: string };

export default async function FatturaPage({ params }: PageProps<"/fatture/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const [inv, settings] = await Promise.all([getInvoice(id), getCompanySettings()]);
  if (!inv) notFound();
  const canManage = can.manageMoney(user.role);
  const st = INVOICE_STATUS[inv.status];
  const editable = ["bozza", "scartata", "errore"].includes(inv.status);
  const errors = Array.isArray(inv.sdi_errors) ? (inv.sdi_errors as SdiError[]) : [];
  const title = inv.number ? `${DOC_TYPES[inv.doc_type]} n. ${inv.number}/${inv.year}` : `${DOC_TYPES[inv.doc_type]} (bozza)`;

  const header = (
    <PageHeader
      area="money"
      icon={Receipt}
      eyebrow={
        <Link href="/fatture" className="flex items-center gap-1 hover:underline">
          <ArrowLeft className="size-3" /> Fatture
        </Link>
      }
      title={
        <span className="flex flex-wrap items-center gap-3">
          {title}
          <Badge dot tone={st.tone}>
            {st.label}
          </Badge>
          {inv.test && (
            <span className="flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
              <FlaskConical className="size-3" /> Prova
            </span>
          )}
        </span>
      }
      description={`${inv.client?.name ?? ""} · ${formatDate(inv.date)} · ${formatEuro(inv.total_cents)}`}
      actions={
        <>
          {(inv.status === "in_invio" || inv.status === "inviata") && <RefreshButton />}
          <Button asChild variant="outline" size="sm">
            <a href={`/stampa/fattura/${inv.id}`} target="_blank" rel="noreferrer">
              <Printer /> {inv.xml ? "Vedi / stampa" : "Anteprima"}
            </a>
          </Button>
          {inv.xml && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/fatture/xml?tipo=emessa&id=${inv.id}`}>
                <Download /> XML
              </a>
            </Button>
          )}
        </>
      }
    />
  );

  // Messaggio di stato in evidenza
  const banner =
    inv.status === "scartata" || inv.status === "errore" || inv.status === "non_consegnata" ? (
      <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px]">
        <p className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="size-4" /> {st.hint}
        </p>
        {inv.sdi_message && <p className="mt-1">{inv.sdi_message}</p>}
        {errors.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>
                {e.code && <b>{e.code}: </b>}
                {e.description}
                {e.hint && <span className="text-muted-foreground"> — {e.hint}</span>}
              </li>
            ))}
          </ul>
        )}
        {inv.status === "scartata" && (
          <p className="mt-1 text-muted-foreground">Correggi qui sotto (o i dati del cliente) e premi «Salva e reinvia»: numero e data restano gli stessi.</p>
        )}
      </div>
    ) : inv.status === "consegnata" ? (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 px-4 py-3 text-[13px]">
        <CheckCircle2 className="size-4 text-success" />
        <span>
          <b>Fattura emessa.</b> {inv.sdi_state === "ImpossibilitaDiRecapito" ? "Il cliente non ha un canale di ricezione: la trova nel suo cassetto fiscale (avvisalo e mandagli la copia)." : "Consegnata al cliente"}
          {inv.delivered_at ? ` il ${formatDate(inv.delivered_at)}` : ""}.
        </span>
      </div>
    ) : inv.status === "inviata" || inv.status === "in_invio" ? (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-[13px]">
        <Send className="size-4 text-primary" />
        <span>{st.hint}. Lo stato si aggiorna da solo ogni 10 minuti; puoi anche premere «Aggiorna stato».</span>
      </div>
    ) : null;

  if (editable) {
    const [clients, projects, receivables] = await Promise.all([listInvoiceClients(), listProjectsForInvoices(), listUninvoicedReceivables()]);
    // controlli dell'invio già visibili sulla bozza (dati mancanti di azienda o cliente)
    const checks = inv.client
      ? checkInvoice(toCompany(settings), toCustomer(inv.client), {
          docType: inv.doc_type,
          number: inv.number ?? 1,
          year: Number(inv.date.slice(0, 4)),
          date: inv.date,
          attempt: inv.attempts + 1,
          causale: inv.causale,
          paymentMethod: inv.payment_method,
          paymentDue: inv.payment_due,
          iban: inv.iban,
          related: inv.related?.number ? { number: String(inv.related.number), date: inv.related.date } : null,
          lines: inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceCents: l.unit_price_cents, vatRate: Number(l.vat_rate), vatNature: l.vat_nature })),
        })
      : [];
    return (
      <>
        {header}
        <PageBody>
          {banner}
          <InvoiceEditor
            invoice={inv}
            clients={clients}
            projects={projects}
            receivables={receivables}
            defaultVat={Number(settings.default_vat_rate)}
            regime={settings.tax_regime}
            canManage={canManage}
            checks={checks}
          />
          {canManage && (
            <div className="mt-6 border-t pt-4">
              <InvoiceSideActions id={inv.id} canCredit={false} canDelete={!inv.number} />
            </div>
          )}
        </PageBody>
      </>
    );
  }

  const lines = inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceCents: l.unit_price_cents, vatRate: Number(l.vat_rate), vatNature: l.vat_nature }));
  const tot = summary(lines);
  const steps = [
    { label: "Creata", at: inv.created_at, done: true },
    { label: "Inviata allo SDI", at: inv.sent_at, done: !!inv.sent_at },
    { label: inv.status === "non_consegnata" ? "Non consegnata" : "Consegnata", at: inv.delivered_at ?? (inv.status === "non_consegnata" ? inv.last_sdi_update : null), done: inv.status === "consegnata" || inv.status === "non_consegnata" },
  ];

  return (
    <>
      {header}
      <PageBody>
        {banner}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-3 rounded-xl border bg-card p-4 text-[13px] shadow-xs sm:grid-cols-2">
              <div>
                <p className="text-[12px] text-muted-foreground">Cliente</p>
                <Link href={`/clienti/${inv.client_id}`} className="font-semibold hover:underline">
                  {inv.client?.legal_name || inv.client?.name}
                </Link>
                <p className="text-muted-foreground">{[inv.client?.vat_number && `P.IVA ${inv.client.vat_number}`, inv.client?.sdi_code && `SDI ${inv.client.sdi_code}`].filter(Boolean).join(" · ")}</p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">Pagamento</p>
                <p className="font-semibold">
                  {PAYMENT_METHODS[inv.payment_method] ?? inv.payment_method}
                  {inv.payment_due ? ` entro il ${formatDate(inv.payment_due)}` : ""}
                </p>
                {inv.project && (
                  <p className="text-muted-foreground">
                    Progetto{" "}
                    <Link href={`/progetti/${inv.project.id}`} className="hover:underline">
                      {inv.project.code} {inv.project.name}
                    </Link>
                  </p>
                )}
              </div>
              {inv.related && (
                <p className="sm:col-span-2">
                  Storna la fattura{" "}
                  <Link href={`/fatture/${inv.related.id}`} className="font-semibold text-primary hover:underline">
                    n. {inv.related.number}/{inv.related.year}
                  </Link>
                </p>
              )}
              {inv.causale && <p className="text-muted-foreground sm:col-span-2">{inv.causale}</p>}
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 text-left text-[12px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Descrizione</th>
                    <th className="px-2 py-2 text-right font-medium">Q.tà</th>
                    <th className="px-2 py-2 text-right font-medium">Prezzo</th>
                    <th className="px-2 py-2 text-right font-medium">IVA</th>
                    <th className="px-4 py-2 text-right font-medium">Totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inv.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2 whitespace-pre-line">{l.description}</td>
                      <td className="px-2 py-2 text-right tabular">{Number(l.quantity).toLocaleString("it-IT")}</td>
                      <td className="px-2 py-2 text-right tabular">{formatEuro(l.unit_price_cents)}</td>
                      <td className="px-2 py-2 text-right" title={l.vat_nature ? NATURES[l.vat_nature]?.label : undefined}>
                        {Number(l.vat_rate) > 0 ? `${Number(l.vat_rate)}%` : l.vat_nature}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular">{formatEuro(Math.round(Number(l.quantity) * l.unit_price_cents))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="flex flex-col gap-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <dl className="flex flex-col gap-1.5 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Imponibile</dt>
                  <dd className="tabular">{formatEuro(tot.net)}</dd>
                </div>
                {tot.rows.map((r) => (
                  <div key={`${r.rate}-${r.nature}`} className="flex justify-between text-[12.5px] text-muted-foreground">
                    <dt>{r.rate > 0 ? `IVA ${r.rate}%` : (r.nature ?? "Senza IVA")}</dt>
                    <dd className="tabular">{formatEuro(r.vat)}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-2 text-[16px] font-semibold">
                  <dt>Totale</dt>
                  <dd className="tabular">{formatEuro(inv.total_cents)}</dd>
                </div>
              </dl>
            </div>
            <ol className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-[13px] shadow-xs">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", s.done ? "bg-success" : "bg-muted-foreground/30")} />
                  <span className={cn(!s.done && "text-muted-foreground")}>{s.label}</span>
                  {s.at && <span className="ml-auto text-[12px] text-muted-foreground">{formatDate(s.at)}</span>}
                </li>
              ))}
              {inv.sdi_identifier && <li className="pt-1 text-[11.5px] text-muted-foreground">Identificativo SDI {inv.sdi_identifier}</li>}
              {inv.file_name && <li className="text-[11.5px] break-all text-muted-foreground">{inv.file_name}</li>}
            </ol>
            {canManage && <InvoiceSideActions id={inv.id} canCredit={inv.doc_type !== "TD04" && inv.status === "consegnata"} canDelete={false} />}
          </aside>
        </div>
      </PageBody>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { RENEWAL_FREQUENCY } from "@/lib/labels";
import { formatDate, formatEuro } from "@/lib/utils";
import { PrintButton } from "@/modules/preventivi/components/print-button";
import { getCompany, getQuote } from "@/modules/preventivi/queries";
import { lineTotal, quoteTotals } from "@/modules/preventivi/totals";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/stampa/preventivo/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Preventivo" };
  const q = await getQuote(id);
  // Il titolo diventa il nome del PDF salvato dal browser
  return { title: { absolute: q ? `Preventivo ${q.number} – ${q.title}` : "Preventivo" } };
}

const qty = (n: number) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: 2 });

export default async function StampaPreventivo({ params }: PageProps<"/stampa/preventivo/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const [quote, company] = await Promise.all([getQuote(id), getCompany()]);
  if (!quote) notFound();

  const t = quoteTotals(quote.items, quote.discount_cents, quote.vat_rate);
  const oneOff = quote.items.filter((i) => !i.frequency);
  const recurring = quote.items.filter((i) => i.frequency);
  const deposit = quote.deposit_pct > 0 && quote.deposit_pct < 100 ? Math.round((t.total * quote.deposit_pct) / 100) : 0;
  const c = quote.client;
  const recipientLines = c
    ? [c.legal_name || c.name, c.address, [c.zip, c.city, c.province && `(${c.province})`].filter(Boolean).join(" "), c.vat_number && `P.IVA ${c.vat_number}`, c.pec && `PEC ${c.pec}`]
    : [quote.lead?.company_name ?? quote.lead?.title, quote.lead?.contact_name && `c.a. ${quote.lead.contact_name}`, quote.lead?.email];

  return (
    <div className="min-h-svh bg-[#eef1f6] py-8 text-[#1b2233] print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 16mm 14mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Link href={`/preventivi/${quote.id}`} className="text-[13px] text-[#5b6478] hover:underline">
          ← Torna al preventivo
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[14mm] shadow-lg print:max-w-none print:p-0 print:shadow-none">
        {/* Intestazione */}
        <header className="flex items-start justify-between gap-8 border-b-[3px] border-[#1F4196] pb-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#1F4196] text-xl font-bold text-white">O</span>
            <div className="text-[11.5px] leading-relaxed text-[#5b6478]">
              <p className="text-[17px] font-semibold text-[#1b2233]">{company?.legal_name ?? "Omnira Soft"}</p>
              {company?.address && <p>{company.address}</p>}
              <p>{[company?.vat_number && `P.IVA ${company.vat_number}`, company?.tax_code && `C.F. ${company.tax_code}`].filter(Boolean).join(" · ")}</p>
              <p>{[company?.email, company?.phone].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#1F4196] uppercase">Preventivo</p>
            <p className="font-mono text-[15px] font-semibold">{quote.number}</p>
            <p className="mt-1 text-[11.5px] text-[#5b6478]">del {formatDate(quote.issue_date)}</p>
            <p className="text-[11.5px] text-[#5b6478]">valido fino al {formatDate(quote.valid_until)}</p>
          </div>
        </header>

        {/* Destinatario e oggetto */}
        <section className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:gap-8 print:grid-cols-[1fr_auto] print:gap-8">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[#8a93a6] uppercase">Oggetto</p>
            <h1 className="mt-1 text-[22px] leading-tight font-semibold">{quote.title}</h1>
          </div>
          <div className="rounded-lg sm:min-w-[60mm] print:min-w-[60mm] bg-[#f4f6fa] p-3.5 text-[12px] leading-relaxed">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[#8a93a6] uppercase">Spett.le</p>
            {recipientLines.filter(Boolean).map((l, i) => (
              <p key={i} className={i === 0 ? "text-[13.5px] font-semibold" : "text-[#5b6478]"}>{l}</p>
            ))}
          </div>
        </section>

        {quote.intro && <p className="mt-6 text-[12.5px] leading-relaxed whitespace-pre-wrap">{quote.intro}</p>}

        {/* Voci una tantum */}
        {oneOff.length > 0 && (
          <table className="mt-6 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-[#1b2233] text-left text-[10.5px] tracking-wider text-[#5b6478] uppercase">
                <th className="py-2 pr-3 font-semibold">Descrizione</th>
                <th className="w-[16mm] py-2 text-right font-semibold">Q.tà</th>
                <th className="w-[26mm] py-2 text-right font-semibold">Prezzo</th>
                <th className="w-[28mm] py-2 text-right font-semibold">Totale</th>
              </tr>
            </thead>
            <tbody>
              {oneOff.map((i) => (
                <tr key={i.id} className="break-inside-avoid border-b border-[#e3e7ef] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{i.description}</p>
                    {i.details && <p className="mt-0.5 text-[11.5px] leading-snug whitespace-pre-wrap text-[#5b6478]">{i.details}</p>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {qty(i.quantity)} <span className="text-[#8a93a6]">{i.unit}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatEuro(i.unit_price_cents)}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{formatEuro(lineTotal(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totali */}
        <section className="mt-4 flex justify-end break-inside-avoid">
          <dl className="w-[78mm] text-[12px]">
            <div className="flex justify-between py-1"><dt className="text-[#5b6478]">Imponibile</dt><dd className="tabular-nums">{formatEuro(t.oneOff)}</dd></div>
            {t.discount > 0 && <div className="flex justify-between py-1"><dt className="text-[#5b6478]">Sconto</dt><dd className="tabular-nums">− {formatEuro(t.discount)}</dd></div>}
            <div className="flex justify-between py-1"><dt className="text-[#5b6478]">IVA {Number(quote.vat_rate)}%</dt><dd className="tabular-nums">{formatEuro(t.vat)}</dd></div>
            <div className="mt-1 flex items-baseline justify-between rounded-lg bg-[#1F4196] px-3 py-2.5 text-white">
              <dt className="font-semibold">Totale</dt>
              <dd className="text-[17px] font-semibold tabular-nums">{formatEuro(t.total)}</dd>
            </div>
          </dl>
        </section>

        {/* Canoni */}
        {recurring.length > 0 && (
          <section className="mt-7 break-inside-avoid">
            <h2 className="text-[13px] font-semibold">Servizi ricorrenti</h2>
            <p className="text-[11.5px] text-[#5b6478]">Esclusi dal totale: si rinnovano alla scadenza di ogni periodo.</p>
            <table className="mt-2 w-full border-collapse text-[12px]">
              <tbody>
                {recurring.map((i) => (
                  <tr key={i.id} className="border-b border-[#e3e7ef] align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{i.description}</p>
                      {i.details && <p className="text-[11.5px] text-[#5b6478]">{i.details}</p>}
                    </td>
                    <td className="w-[34mm] py-2 text-right text-[#5b6478]">{RENEWAL_FREQUENCY[i.frequency!]!.label}</td>
                    <td className="w-[34mm] py-2 text-right font-medium tabular-nums">{formatEuro(lineTotal(i))} + IVA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Condizioni */}
        <section className="mt-7 grid grid-cols-2 gap-6 break-inside-avoid text-[11.5px] leading-relaxed">
          <div>
            <h2 className="mb-1 text-[12.5px] font-semibold">Pagamento</h2>
            {deposit > 0 ? (
              <p className="text-[#5b6478]">
                Acconto del {quote.deposit_pct}% ({formatEuro(deposit)}) all&apos;accettazione, saldo di {formatEuro(t.total - deposit)} alla consegna.
              </p>
            ) : (
              <p className="text-[#5b6478]">{quote.deposit_pct === 100 ? "Intero importo all'accettazione." : "Intero importo alla consegna."}</p>
            )}
            {company?.iban && <p className="mt-1 text-[#5b6478]">Bonifico su IBAN <span className="font-mono text-[#1b2233]">{company.iban}</span></p>}
          </div>
          {quote.terms && (
            <div>
              <h2 className="mb-1 text-[12.5px] font-semibold">Condizioni</h2>
              <p className="whitespace-pre-wrap text-[#5b6478]">{quote.terms}</p>
            </div>
          )}
        </section>

        {/* Accettazione */}
        <section className="mt-10 grid grid-cols-2 gap-10 break-inside-avoid text-[11.5px]">
          <div>
            <p className="text-[#5b6478]">{company?.legal_name ?? "Omnira Soft"}</p>
            <p className="mt-1 font-medium">{quote.owner?.full_name}</p>
          </div>
          <div>
            <p className="text-[#5b6478]">Per accettazione (data, timbro e firma)</p>
            <div className="mt-10 border-b border-[#1b2233]" />
          </div>
        </section>
      </article>
    </div>
  );
}

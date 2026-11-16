import Link from "next/link";
import { formatDate, formatEuro } from "@/lib/utils";
import { PrintButton } from "@/modules/preventivi/components/print-button";
import { DOC_TYPES, NATURES, PAYMENT_METHODS } from "../common";
import type { ParsedInvoice } from "../xml";

const qty = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 3 });

/** Copia di cortesia leggibile di una fattura elettronica (emessa o ricevuta) */
export function InvoicePrint({ p, back, backLabel, banner, paymentMethod }: { p: ParsedInvoice; back: string; backLabel: string; banner?: string | null; paymentMethod?: string | null }) {
  const docLabel = DOC_TYPES[p.docType as keyof typeof DOC_TYPES] ?? "Fattura";
  return (
    <div className="min-h-svh bg-[#eef1f6] py-8 text-[#1b2233] print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 16mm 14mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Link href={back} className="text-[13px] text-[#5b6478] hover:underline">
          ← {backLabel}
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[14mm] text-[12px] shadow-lg print:max-w-none print:p-0 print:shadow-none">
        {banner && <p className="mb-4 rounded border border-[#e7b416] bg-[#fff7d6] px-3 py-1.5 text-center text-[11.5px] font-semibold">{banner}</p>}
        <header className="flex items-start justify-between gap-8 border-b-[3px] border-[#0f7a4a] pb-4">
          <div className="leading-relaxed">
            <p className="text-[16px] font-semibold">{p.supplier.name}</p>
            <p className="text-[#5b6478]">{p.supplier.address}</p>
            <p className="text-[#5b6478]">{[p.supplier.vat && `P.IVA ${p.supplier.vat}`, p.supplier.taxCode && `C.F. ${p.supplier.taxCode}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tracking-wider text-[#0f7a4a] uppercase">{docLabel}</p>
            <p className="text-[20px] font-semibold">n. {p.number}</p>
            <p className="text-[#5b6478]">del {formatDate(p.date)}</p>
          </div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10.5px] font-semibold tracking-wider text-[#5b6478] uppercase">Cliente</p>
            <p className="text-[13px] font-semibold">{p.customer.name}</p>
            {p.customer.vat && <p className="text-[#5b6478]">P.IVA {p.customer.vat}</p>}
          </div>
          {p.causale && (
            <div>
              <p className="text-[10.5px] font-semibold tracking-wider text-[#5b6478] uppercase">Causale</p>
              <p>{p.causale}</p>
            </div>
          )}
        </section>
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d6dbe6] text-left text-[10.5px] tracking-wider text-[#5b6478] uppercase">
              <th className="py-2 font-semibold">Descrizione</th>
              <th className="py-2 text-right font-semibold">Q.tà</th>
              <th className="py-2 text-right font-semibold">Prezzo</th>
              <th className="py-2 text-right font-semibold">IVA</th>
              <th className="py-2 text-right font-semibold">Importo</th>
            </tr>
          </thead>
          <tbody>
            {p.lines.map((l, i) => (
              <tr key={i} className="border-b border-[#eef1f6] align-top">
                <td className="py-2 pr-4 whitespace-pre-line">{l.description}</td>
                <td className="py-2 text-right tabular-nums">{qty(l.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{formatEuro(l.unitPrice)}</td>
                <td className="py-2 text-right">{l.vatRate > 0 ? `${l.vatRate}%` : l.nature}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatEuro(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="mt-4 flex justify-end">
          <dl className="w-72 text-[12.5px]">
            {p.summary.map((r, i) => (
              <div key={i} className="flex justify-between py-0.5 text-[#5b6478]">
                <dt>{r.rate > 0 ? `Imponibile ${r.rate}% · IVA` : `${r.nature ?? ""} ${NATURES[r.nature ?? ""]?.ref ?? ""}`}</dt>
                <dd className="tabular-nums">
                  {formatEuro(r.net)}
                  {r.rate > 0 ? ` · ${formatEuro(r.vat)}` : ""}
                </dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t-2 border-[#1b2233] pt-2 text-[15px] font-semibold">
              <dt>Totale documento</dt>
              <dd className="tabular-nums">{formatEuro(p.total)}</dd>
            </div>
          </dl>
        </section>
        {(p.due || p.iban || paymentMethod) && (
          <section className="mt-6 rounded border border-[#d6dbe6] px-3 py-2 text-[12px]">
            <span className="font-semibold">Pagamento: </span>
            {[paymentMethod && (PAYMENT_METHODS[paymentMethod] ?? paymentMethod), p.due && `entro il ${formatDate(p.due)}`, p.iban && `IBAN ${p.iban}`].filter(Boolean).join(" · ")}
          </section>
        )}
        <footer className="mt-8 text-[10.5px] text-[#8a92a6]">
          Copia di cortesia: il documento fiscalmente valido è il file XML trasmesso tramite il Sistema di Interscambio.
        </footer>
      </article>
    </div>
  );
}

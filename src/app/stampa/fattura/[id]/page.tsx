import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InvoicePrint } from "@/modules/fatture/components/invoice-print";
import { getCompanySettings, getInvoice, toCompany, toCustomer } from "@/modules/fatture/queries";
import { buildXml, parseInvoiceXml } from "@/modules/fatture/xml";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/stampa/fattura/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Fattura" };
  const inv = await getInvoice(id);
  return { title: { absolute: inv?.number ? `Fattura ${inv.number}-${inv.year} ${inv.client?.name ?? ""}` : "Anteprima fattura" } };
}

export default async function StampaFattura({ params }: PageProps<"/stampa/fattura/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const [inv, settings] = await Promise.all([getInvoice(id), getCompanySettings()]);
  if (!inv || !inv.client) notFound();
  const xml =
    inv.xml ??
    buildXml(toCompany(settings), toCustomer(inv.client), {
      docType: inv.doc_type,
      number: inv.number ?? 0,
      year: inv.year ?? Number(inv.date.slice(0, 4)),
      date: inv.date,
      attempt: 1,
      causale: inv.causale,
      paymentMethod: inv.payment_method,
      paymentDue: inv.payment_due,
      iban: inv.iban,
      related: inv.related?.number ? { number: String(inv.related.number), date: inv.related.date } : null,
      lines: inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceCents: l.unit_price_cents, vatRate: Number(l.vat_rate), vatNature: l.vat_nature })),
    });
  const p = parseInvoiceXml(xml);
  if (!p) notFound();
  if (!inv.number) p.number = "— (bozza)";
  return (
    <InvoicePrint
      p={p}
      back={`/fatture/${inv.id}`}
      backLabel="Torna alla fattura"
      paymentMethod={inv.payment_method}
      banner={inv.test ? "FATTURA DI PROVA – non valida ai fini fiscali" : !inv.xml ? "ANTEPRIMA – fattura non ancora inviata" : null}
    />
  );
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettingsRow, Json } from "@/lib/database.types";
import { type Company, type Customer, extractXml, parseInvoiceXml } from "./xml";

export async function getCompanySettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).single();
  return data as CompanySettingsRow;
}

export function toCompany(c: CompanySettingsRow): Company {
  return {
    name: c.legal_name,
    vat: c.vat_number,
    taxCode: c.tax_code,
    address: c.address,
    zip: c.zip,
    city: c.city,
    province: c.province,
    country: c.country,
    taxRegime: c.tax_regime,
    reaOffice: c.rea_office,
    reaNumber: c.rea_number,
    iban: c.iban,
  };
}

type ClientLike = {
  name: string;
  legal_name: string | null;
  vat_number: string | null;
  tax_code: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  sdi_code: string | null;
  pec: string | null;
};
export function toCustomer(c: ClientLike): Customer {
  return {
    name: c.legal_name || c.name,
    vat: c.vat_number,
    taxCode: c.tax_code,
    address: c.address,
    zip: c.zip,
    city: c.city,
    province: c.province,
    country: c.country,
    sdiCode: c.sdi_code,
    pec: c.pec,
  };
}

/** Stato del collegamento con lo SDI, senza segreti */
export async function getInvoicingInfo() {
  const supabase = await createClient();
  const [settings, ready] = await Promise.all([getCompanySettings(), supabase.rpc("invoicing_ready")]);
  const status = (settings.invoicing_status ?? null) as { ok?: boolean; operation_left?: number; detail?: string; code?: number } | null;
  const missing: string[] = [];
  if (!settings.vat_number) missing.push("partita IVA");
  if (!settings.address || !settings.zip || !settings.city) missing.push("indirizzo");
  if (!settings.iban) missing.push("IBAN");
  return {
    mode: settings.invoicing_mode,
    ready: !!ready.data,
    status,
    checkedAt: settings.invoicing_checked_at,
    missing,
    prefix: settings.invoice_prefix,
  };
}
export type InvoicingInfo = Awaited<ReturnType<typeof getInvoicingInfo>>;

const LIST =
  "id, test, doc_type, year, number, date, client_id, project_id, causale, net_cents, vat_cents, total_cents, status, sdi_state, sdi_message, sent_at, delivered_at, payment_due, created_at, updated_at, client:clients(id, name), project:projects(id, code, name)";

export async function listInvoices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(LIST)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("number", { ascending: false, nullsFirst: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data;
}
export type InvoiceListItem = Awaited<ReturnType<typeof listInvoices>>[number];

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "*, client:clients(id, name, legal_name, vat_number, tax_code, address, zip, city, province, country, sdi_code, pec), project:projects(id, code, name), lines:invoice_lines(*, receivable:receivables(id, description, amount_cents))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const related = data.related_invoice_id
    ? ((await supabase.from("invoices").select("id, number, year, date, doc_type").eq("id", data.related_invoice_id).maybeSingle()).data ?? null)
    : null;
  return { ...data, related, lines: [...data.lines].sort((a, b) => a.position - b.position) };
}
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

/** Clienti con tutti i dati che servono in fattura */
export async function listInvoiceClients() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, legal_name, vat_number, tax_code, address, zip, city, province, country, sdi_code, pec")
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}
export type InvoiceClient = Awaited<ReturnType<typeof listInvoiceClients>>[number];

export async function listProjectsForInvoices() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, code, name, client_id").is("deleted_at", null).order("created_at", { ascending: false });
  return data ?? [];
}

/** Importi da incassare non ancora fatturati (per aggiungerli come righe) */
export async function listUninvoicedReceivables() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receivables")
    .select("id, client_id, project_id, description, amount_cents, due_date, lines:invoice_lines(id, invoice:invoices(id, status, deleted_at))")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? [])
    .filter((r) => !r.lines.some((l) => l.invoice && !l.invoice.deleted_at))
    .map(({ lines: _l, ...r }) => (void _l, r));
}
export type UninvoicedReceivable = Awaited<ReturnType<typeof listUninvoicedReceivables>>[number];

// ---------------------------------------------------------------------------
// Ricevute
// ---------------------------------------------------------------------------

/** Legge l'XML delle fatture appena arrivate e salva fornitore, importi e scadenza */
async function parsePending() {
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_invoices").select("id, payload, encoding").is("parsed_at", null).not("payload", "is", null).limit(50);
  for (const row of data ?? []) {
    const xml = extractXml(row.payload!, row.encoding);
    const p = xml ? parseInvoiceXml(xml) : null;
    await supabase
      .from("purchase_invoices")
      .update(
        p
          ? {
              parsed_at: new Date().toISOString(),
              supplier_name: p.supplier.name || undefined,
              supplier_vat: p.supplier.vat ?? undefined,
              number: p.number,
              doc_date: p.date,
              doc_type: p.docType,
              net_cents: p.net,
              vat_cents: p.vat,
              total_cents: p.total,
              due_date: p.due,
              description: (p.causale || p.lines.map((l) => l.description).join(" · ")).slice(0, 500),
            }
          : { parsed_at: new Date().toISOString() },
      )
      .eq("id", row.id);
  }
}

const PLIST =
  "id, test, supplier_name, supplier_vat, number, doc_date, doc_type, net_cents, vat_cents, total_cents, due_date, description, status, expense_id, project_id, received_at, source, notes, project:projects(id, code, name)";

export async function listPurchaseInvoices() {
  await parsePending();
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_invoices").select(PLIST).order("doc_date", { ascending: false, nullsFirst: true }).limit(2000);
  if (error) throw new Error(error.message);
  return data;
}
export type PurchaseListItem = Awaited<ReturnType<typeof listPurchaseInvoices>>[number];

export async function getPurchaseXml(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_invoices").select("id, payload, encoding, file_name, number, supplier_name").eq("id", id).maybeSingle();
  if (!data?.payload) return null;
  const xml = extractXml(data.payload, data.encoding);
  return xml ? { xml, fileName: data.file_name ?? `fattura-${data.number ?? data.id}.xml`, parsed: parseInvoiceXml(xml) } : null;
}

export const asJson = (v: unknown) => v as Json;

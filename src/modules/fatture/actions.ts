"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCompanySettings, getInvoice, toCompany, toCustomer } from "./queries";
import { type InvoiceInput, buildXml, checkInvoice, extractXml, fileName, parseInvoiceXml } from "./xml";

const MONEY = ["admin", "amministrazione", "project_manager"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const lineSchema = z.object({
  description: z.string().trim().min(1, "Descrizione obbligatoria").max(1000),
  quantity: z.coerce.number().positive("Quantità maggiore di zero").max(1_000_000),
  unit_price_cents: z.coerce.number().int().min(-100_000_000).max(100_000_000),
  vat_rate: z.coerce.number().min(0).max(99),
  vat_nature: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v || null),
  receivable_id: z.guid().nullable().optional(),
});

const invoiceSchema = z
  .object({
    doc_type: z.enum(["TD01", "TD02", "TD04", "TD06"]),
    date: z.iso.date("Data non valida"),
    client_id: z.guid("Scegli il cliente"),
    project_id: z.guid().nullable().optional(),
    related_invoice_id: z.guid().nullable().optional(),
    causale: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => v || null),
    notes: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => v || null),
    payment_method: z.string().regex(/^MP\d{2}$/),
    payment_due: z.iso.date().nullable().optional(),
    lines: z.array(lineSchema).min(1, "Aggiungi almeno una riga").max(200),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((l, i) => {
      if (l.vat_rate === 0 && !l.vat_nature) ctx.addIssue({ code: "custom", path: ["lines"], message: `Riga ${i + 1}: senza IVA scegli la natura dell'operazione` });
    });
  });
export type InvoiceFormInput = z.input<typeof invoiceSchema>;

async function writeLines(supabase: Awaited<ReturnType<typeof createClient>>, invoiceId: string, lines: z.output<typeof lineSchema>[]) {
  const del = await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
  if (del.error) return del.error;
  const ins = await supabase.from("invoice_lines").insert(
    lines.map((l, i) => ({
      invoice_id: invoiceId,
      position: i,
      description: l.description,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      vat_rate: l.vat_rate,
      vat_nature: l.vat_rate === 0 ? l.vat_nature : null,
      receivable_id: l.receivable_id ?? null,
    })),
  );
  return ins.error;
}

export async function saveInvoiceAction(id: string | null, input: InvoiceFormInput): Promise<ActionResult<string>> {
  await requireRole([...MONEY]);
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error) as ActionResult<string>;
  const { lines, ...head } = parsed.data;
  const supabase = await createClient();
  let invoiceId = id;
  if (!invoiceId) {
    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...head, project_id: head.project_id ?? null, related_invoice_id: head.related_invoice_id ?? null, payment_due: head.payment_due ?? null })
      .select("id")
      .single();
    if (error || !data) return fromDbError(error ?? { message: "insert" }) as ActionResult<string>;
    invoiceId = data.id;
  } else {
    const { error } = await supabase
      .from("invoices")
      .update({ ...head, project_id: head.project_id ?? null, related_invoice_id: head.related_invoice_id ?? null, payment_due: head.payment_due ?? null })
      .eq("id", z.guid().parse(invoiceId));
    if (error) return fromDbError(error) as ActionResult<string>;
  }
  const err = await writeLines(supabase, invoiceId, lines);
  if (err) return fromDbError(err) as ActionResult<string>;
  revalidatePath("/fatture");
  revalidatePath("/incassi");
  return { ok: true, data: invoiceId, message: "Bozza salvata" };
}

export async function deleteDraftAction(id: string): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidatePath("/fatture");
  revalidatePath("/incassi");
  return { ok: true, message: "Bozza eliminata" };
}

/** Controlla i dati, assegna il numero, genera l'XML e lo invia allo SDI tramite Invoicetronic */
export async function sendInvoiceAction(id: string): Promise<ActionResult<{ status: string; message?: string | null }>> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const [inv, settings] = await Promise.all([getInvoice(z.guid().parse(id)), getCompanySettings()]);
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  if (!["bozza", "scartata", "errore"].includes(inv.status)) return { ok: false, error: "Fattura già inviata" };
  if (!inv.client) return { ok: false, error: "Cliente non trovato" };

  const company = toCompany(settings);
  const customer = toCustomer(inv.client);
  const draft: InvoiceInput = {
    docType: inv.doc_type,
    number: inv.number ?? 1,
    year: inv.year ?? Number(inv.date.slice(0, 4)),
    date: inv.date,
    attempt: inv.attempts + 1,
    causale: inv.causale,
    paymentMethod: inv.payment_method,
    paymentDue: inv.payment_due,
    iban: inv.iban,
    related: inv.related?.number ? { number: String(inv.related.number), date: inv.related.date } : null,
    lines: inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceCents: l.unit_price_cents, vatRate: Number(l.vat_rate), vatNature: l.vat_nature })),
  };
  const problems = checkInvoice(company, customer, draft);
  if (problems.length) return { ok: false, error: problems.join(" · ") };

  const { data: number, error: numErr } = await supabase.rpc("invoice_assign_number", { p_invoice: inv.id });
  if (numErr) return fromDbError(numErr) as ActionResult<{ status: string }>;
  const final = { ...draft, number: number as number, year: Number(inv.date.slice(0, 4)) };
  const xml = buildXml(company, customer, final);
  const name = fileName(company, final);
  const { error } = await supabase.rpc("invoice_submit", { p_invoice: inv.id, p_xml: xml, p_file_name: name, p_customer: customer as unknown as Json });
  if (error) return fromDbError(error) as ActionResult<{ status: string }>;

  // la risposta di Invoicetronic arriva in pochi secondi: la leggo subito
  let status = "in_invio";
  let message: string | null = null;
  for (let i = 0; i < 4 && status === "in_invio"; i++) {
    await sleep(1500);
    await supabase.rpc("invoicing_sync");
    const { data } = await supabase.from("invoices").select("status, sdi_message").eq("id", inv.id).single();
    status = data?.status ?? status;
    message = data?.sdi_message ?? null;
  }
  revalidatePath("/fatture");
  revalidatePath("/incassi");
  if (status === "errore") return { ok: false, error: message ?? "Invio non riuscito" };
  return {
    ok: true,
    data: { status, message },
    message: status === "in_invio" ? "Fattura in invio: lo stato si aggiorna da solo" : "Fattura inviata allo SDI",
  };
}

/** Chiede subito gli aggiornamenti (stati SDI e fatture ricevute) */
export async function refreshInvoicingAction(): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("invoicing_sync");
  if (error) return fromDbError(error);
  await sleep(2500);
  const second = await supabase.rpc("invoicing_sync");
  revalidatePath("/fatture");
  const r = (second.data ?? {}) as { aggiornate?: number; ricevute?: number };
  const parts = [r.aggiornate ? `${r.aggiornate} stati aggiornati` : null, r.ricevute ? `${r.ricevute} fatture ricevute` : null].filter(Boolean);
  return { ok: true, message: parts.length ? parts.join(", ") : "Nessuna novità" };
}

/** Nota di credito collegata (bozza con le stesse righe) */
export async function createCreditNoteAction(id: string): Promise<ActionResult<string>> {
  await requireRole([...MONEY]);
  const inv = await getInvoice(z.guid().parse(id));
  if (!inv || !inv.number) return { ok: false, error: "Fattura non trovata" };
  return saveInvoiceAction(null, {
    doc_type: "TD04",
    date: new Date().toISOString().slice(0, 10),
    client_id: inv.client_id,
    project_id: inv.project_id,
    related_invoice_id: inv.id,
    causale: `Nota di credito a storno della fattura n. ${inv.number} del ${inv.date.split("-").reverse().join("/")}`,
    payment_method: inv.payment_method,
    payment_due: null,
    lines: inv.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit_price_cents: l.unit_price_cents, vat_rate: Number(l.vat_rate), vat_nature: l.vat_nature })),
  });
}

/** Copia come nuova bozza (es. fattura fatta in prova da rifare in reale) */
export async function duplicateInvoiceAction(id: string): Promise<ActionResult<string>> {
  await requireRole([...MONEY]);
  const inv = await getInvoice(z.guid().parse(id));
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  return saveInvoiceAction(null, {
    doc_type: inv.doc_type,
    date: new Date().toISOString().slice(0, 10),
    client_id: inv.client_id,
    project_id: inv.project_id,
    related_invoice_id: inv.related_invoice_id,
    causale: inv.causale,
    notes: inv.notes,
    payment_method: inv.payment_method,
    payment_due: inv.payment_due,
    lines: inv.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit_price_cents: l.unit_price_cents,
      vat_rate: Number(l.vat_rate),
      vat_nature: l.vat_nature,
      receivable_id: inv.test ? l.receivable_id : null,
    })),
  });
}

// ---------------------------------------------------------------------------
// Ricevute
// ---------------------------------------------------------------------------

const CATEGORY = z.enum(["software", "hosting", "domini", "hardware", "collaboratori", "marketing", "trasferte", "formazione", "ufficio", "telefonia", "tasse", "banca", "altro"]);

export async function registerPurchaseAction(id: string, input: { category: string; project_id?: string | null; paid: boolean }): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { data: p } = await supabase.from("purchase_invoices").select("*").eq("id", z.guid().parse(id)).single();
  if (!p) return { ok: false, error: "Fattura non trovata" };
  if (p.expense_id) return { ok: false, error: "Già registrata come spesa" };
  if (!p.total_cents || p.total_cents <= 0) return { ok: false, error: "Importo non leggibile: registra la spesa a mano" };
  const { data: exp, error } = await supabase
    .from("expenses")
    .insert({
      spent_on: p.doc_date ?? new Date().toISOString().slice(0, 10),
      description: `Fattura ${p.number ?? ""} ${p.supplier_name ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 200),
      amount_cents: p.total_cents,
      category: CATEGORY.parse(input.category),
      supplier: p.supplier_name,
      paid_with: "azienda",
      method: "bonifico",
      project_id: input.project_id ?? null,
      notes: p.description,
    })
    .select("id")
    .single();
  if (error || !exp) return fromDbError(error ?? { message: "insert" });
  const { error: e2 } = await supabase
    .from("purchase_invoices")
    .update({ expense_id: exp.id, status: input.paid ? "pagata" : "registrata", project_id: input.project_id ?? null })
    .eq("id", p.id);
  if (e2) return fromDbError(e2);
  revalidatePath("/fatture");
  revalidatePath("/spese");
  return { ok: true, message: "Registrata tra le spese" };
}

export async function setPurchaseStatusAction(id: string, status: "da_registrare" | "registrata" | "pagata" | "ignorata"): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_invoices")
    .update({ status: z.enum(["da_registrare", "registrata", "pagata", "ignorata"]).parse(status) })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidatePath("/fatture");
  return { ok: true };
}

/** Importa fatture di fornitori scaricate dal portale dell'Agenzia (XML o .p7m) */
export async function importPurchaseFilesAction(formData: FormData): Promise<ActionResult<{ imported: number; skipped: number; failed: string[] }>> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const settings = await getCompanySettings();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Nessun file" };
  if (files.length > 200) return { ok: false, error: "Massimo 200 file alla volta" };
  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];
  const myVat = (settings.vat_number ?? "").replace(/\D/g, "");
  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) {
      failed.push(`${f.name} (troppo grande)`);
      continue;
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const b64 = buf.toString("base64");
    const xml = extractXml(b64, "Base64");
    const p = xml ? parseInvoiceXml(xml) : null;
    if (!p) {
      failed.push(`${f.name} (non è una fattura elettronica leggibile)`);
      continue;
    }
    if (myVat && p.supplier.vat?.replace(/\D/g, "") === myVat) {
      failed.push(`${f.name} (è una fattura emessa da voi, non ricevuta)`);
      continue;
    }
    const { error } = await supabase.from("purchase_invoices").insert({
      source: "importata",
      file_name: f.name,
      supplier_name: p.supplier.name,
      supplier_vat: p.supplier.vat,
      number: p.number,
      doc_date: p.date,
      doc_type: p.docType,
      net_cents: p.net,
      vat_cents: p.vat,
      total_cents: p.total,
      due_date: p.due,
      description: (p.causale || p.lines.map((l) => l.description).join(" · ")).slice(0, 500),
      payload: b64,
      encoding: "Base64",
      parsed_at: new Date().toISOString(),
      received_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") skipped++;
      else failed.push(`${f.name} (${error.message})`);
    } else imported++;
  }
  revalidatePath("/fatture");
  return {
    ok: true,
    data: { imported, skipped, failed },
    message: `${imported} importate${skipped ? `, ${skipped} già presenti` : ""}${failed.length ? `, ${failed.length} non lette` : ""}`,
  };
}

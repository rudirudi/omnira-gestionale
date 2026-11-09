"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, euroToCents, fromDbError, fromZodError, optionalText } from "@/lib/action-result";

const MONEY = ["admin", "amministrazione", "project_manager"] as const;

function revalidateMoney(r?: { client_id?: string | null; project_id?: string | null }) {
  revalidatePath("/incassi");
  revalidatePath("/");
  if (r?.client_id) revalidatePath(`/clienti/${r.client_id}`);
  if (r?.project_id) revalidatePath(`/progetti/${r.project_id}`);
}

const requiredEuro = euroToCents.refine((v) => v !== null && v > 0, { message: "Inserisci un importo maggiore di zero" });

const receivableSchema = z.object({
  client_id: z.guid("Scegli il cliente"),
  project_id: optionalText,
  description: z.string().trim().min(1, "Scrivi una descrizione").max(300),
  amount: requiredEuro,
  due_date: optionalText,
  notes: optionalText,
  paid_now: euroToCents,
  paid_method: z.enum(["bonifico", "carta", "contanti", "paypal", "stripe", "riba", "altro"]).optional(),
});

export async function createReceivableAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const parsed = receivableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { amount, paid_now, paid_method, ...row } = parsed.data;
  if (paid_now && paid_now > amount!) return { ok: false, error: "Il già pagato supera l'importo." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("receivables").insert({ ...row, amount_cents: amount! }).select("id").single();
  if (error) return fromDbError(error);
  if (paid_now) {
    await supabase.from("payments").insert({ receivable_id: data.id, amount_cents: paid_now, method: paid_method ?? "bonifico" });
  }
  revalidateMoney(row);
  return { ok: true, message: "Importo aggiunto" };
}

export async function updateReceivableAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const parsed = receivableSchema.omit({ paid_now: true, paid_method: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { amount, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("receivables").update({ ...row, amount_cents: amount! }).eq("id", id);
  if (error) return fromDbError(error);
  revalidateMoney(row);
  return { ok: true, message: "Importo aggiornato" };
}

export async function deleteReceivableAction(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receivables")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .select("client_id, project_id")
    .single();
  if (error) return fromDbError(error);
  revalidateMoney(data);
  return { ok: true, message: "Importo eliminato" };
}

const paymentSchema = z.object({
  receivable_id: z.guid(),
  amount: requiredEuro,
  paid_on: z.string().min(1, "Scegli la data"),
  method: z.enum(["bonifico", "carta", "contanti", "paypal", "stripe", "riba", "altro"]).default("bonifico"),
  note: optionalText,
});

export async function addPaymentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();

  const { data: rec } = await supabase
    .from("receivables")
    .select("amount_cents, client_id, project_id, payments(amount_cents)")
    .eq("id", parsed.data.receivable_id)
    .single();
  if (!rec) return { ok: false, error: "Importo non trovato" };
  const remaining = rec.amount_cents - rec.payments.reduce((s, p) => s + p.amount_cents, 0);
  if (parsed.data.amount! > remaining) {
    return { ok: false, error: `Il pagamento supera il residuo (${(remaining / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}).`, fieldErrors: { amount: ["Supera il residuo"] } };
  }
  const { amount, ...row } = parsed.data;
  const { error } = await supabase.from("payments").insert({ ...row, amount_cents: amount! });
  if (error) return fromDbError(error);
  revalidateMoney(rec);
  return { ok: true, message: amount === remaining ? "Pagamento registrato: importo saldato" : "Pagamento registrato" };
}

export async function deletePaymentAction(id: string): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Pagamento eliminato" };
}

/** Domanda "è stato pagato?" sui rinnovi scaduti: sì → pagamento del residuo; no → resta da incassare */
export async function answerPaymentCheckAction(
  id: string,
  paid: boolean,
  opts: { paidOn?: string; method?: "bonifico" | "carta" | "contanti" | "paypal" | "stripe" | "riba" | "altro" } = {},
): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const rid = z.guid().parse(id);
  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("receivables")
    .select("amount_cents, client_id, project_id, payments(amount_cents)")
    .eq("id", rid)
    .is("deleted_at", null)
    .single();
  if (!rec) return { ok: false, error: "Importo non trovato" };
  if (paid) {
    const remaining = rec.amount_cents - rec.payments.reduce((s, p) => s + p.amount_cents, 0);
    if (remaining > 0) {
      const paidOn = z.iso.date().catch(new Date().toISOString().slice(0, 10)).parse(opts.paidOn);
      const method = z.enum(["bonifico", "carta", "contanti", "paypal", "stripe", "riba", "altro"]).catch("bonifico").parse(opts.method);
      const { error } = await supabase.from("payments").insert({ receivable_id: rid, amount_cents: remaining, paid_on: paidOn, method });
      if (error) return fromDbError(error);
    }
  }
  const { error } = await supabase.from("receivables").update({ payment_confirmed_at: new Date().toISOString() }).eq("id", rid);
  if (error) return fromDbError(error);
  revalidateMoney(rec);
  revalidatePath("/scadenze");
  return { ok: true, message: paid ? "Segnato come pagato: è negli incassati" : "Resta da incassare" };
}

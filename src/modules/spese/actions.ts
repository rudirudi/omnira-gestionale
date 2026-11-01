"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { type ActionResult, euroToCents, fromDbError, fromZodError, optionalText } from "@/lib/action-result";

const CATEGORY = z.enum([
  "software", "hosting", "domini", "hardware", "collaboratori", "marketing",
  "trasferte", "formazione", "ufficio", "telefonia", "tasse", "banca", "altro",
]);
const METHOD = z.enum(["bonifico", "carta", "contanti", "paypal", "stripe", "riba", "altro"]);
const PAID_WITH = z.enum(["azienda", "personale"]);
const FREQUENCY = z.enum(["mensile", "trimestrale", "semestrale", "annuale", "biennale"]);
const requiredEuro = euroToCents.refine((v) => v !== null && v > 0, { message: "Inserisci un importo maggiore di zero" });

function revalidateExpenses(projectId?: string | null) {
  revalidatePath("/spese");
  revalidatePath("/");
  if (projectId) revalidatePath(`/progetti/${projectId}`);
}

/** Chi non gestisce i conti registra solo spese proprie */
async function resolvePayer(requested: string | null | undefined) {
  const user = await getCurrentUser();
  const manager = can.manageMoney(user.role);
  return { user, manager, paidBy: manager && requested ? requested : user.id };
}

const expenseSchema = z.object({
  spent_on: z.string().min(1, "Scegli la data"),
  description: z.string().trim().min(1, "Scrivi una descrizione").max(300),
  amount: requiredEuro,
  category: CATEGORY.default("altro"),
  supplier: optionalText,
  paid_by: optionalText,
  paid_with: PAID_WITH.default("azienda"),
  method: METHOD.default("carta"),
  project_id: optionalText,
  notes: optionalText,
});

async function toExpenseRow(d: z.infer<typeof expenseSchema>) {
  const supabase = await createClient();
  const { paidBy } = await resolvePayer(d.paid_by);
  let clientId: string | null = null;
  if (d.project_id) {
    const { data } = await supabase.from("projects").select("client_id").eq("id", d.project_id).single();
    clientId = data?.client_id ?? null;
  }
  const { amount, ...rest } = d;
  return { ...rest, amount_cents: amount!, paid_by: paidBy, client_id: clientId };
}

export async function createExpenseAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const row = await toExpenseRow(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert(row);
  if (error) return fromDbError(error);
  revalidateExpenses(row.project_id);
  return { ok: true, message: "Spesa registrata" };
}

export async function updateExpenseAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const row = await toExpenseRow(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").update(row).eq("id", z.guid().parse(id)).select("id");
  if (error) return fromDbError(error);
  if (!data.length) return { ok: false, error: "Non puoi modificare questa spesa (forse è già stata rimborsata)." };
  revalidateExpenses(row.project_id);
  return { ok: true, message: "Spesa aggiornata" };
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .select("project_id");
  if (error) return fromDbError(error);
  if (!data.length) return { ok: false, error: "Non puoi eliminare questa spesa." };
  revalidateExpenses(data[0]!.project_id);
  return { ok: true, message: "Spesa eliminata" };
}

export async function setReimbursedAction(id: string, reimbursed: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can.manageMoney(user.role)) return { ok: false, error: "Non hai i permessi per questa operazione." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ reimbursed_on: reimbursed ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidateExpenses();
  return { ok: true, message: reimbursed ? "Segnata come rimborsata" : "Rimborso annullato" };
}

// ---------------------------------------------------------------------------
// Abbonamenti
// ---------------------------------------------------------------------------
const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Scrivi il nome").max(200),
  supplier: optionalText,
  category: CATEGORY.default("software"),
  amount: requiredEuro,
  frequency: FREQUENCY.default("mensile"),
  start_date: z.string().min(1, "Scegli la data del primo addebito"),
  end_date: optionalText,
  paid_by: optionalText,
  paid_with: PAID_WITH.default("azienda"),
  method: METHOD.default("carta"),
  notes: optionalText,
});

export async function createSubscriptionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { amount, paid_by, ...rest } = parsed.data;
  if (rest.end_date && rest.end_date < rest.start_date) {
    return { ok: false, error: "La fine viene prima dell'inizio.", fieldErrors: { end_date: ["Prima dell'inizio"] } };
  }
  const { paidBy } = await resolvePayer(paid_by);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_subscriptions")
    .insert({ ...rest, amount_cents: amount!, paid_by: paidBy })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  // gli addebiti passati li registra il trigger dopo l'inserimento: rileggo il conteggio
  const { data: created } = await supabase.from("expense_subscriptions").select("charges_count").eq("id", data.id).single();
  const charges = created?.charges_count ?? 0;
  revalidateExpenses();
  return {
    ok: true,
    message: charges
      ? `Abbonamento aggiunto: ${charges === 1 ? "registrato 1 addebito" : `registrati ${charges} addebiti`} già passati`
      : "Abbonamento aggiunto: il primo addebito verrà registrato alla data di inizio",
  };
}

/** In modifica cambiano solo i dati dei prossimi addebiti: quelli già registrati restano come sono */
export async function updateSubscriptionAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = subscriptionSchema.partial({ start_date: true, frequency: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { data: current } = await supabase.from("expense_subscriptions").select("charges_count, start_date").eq("id", id).single();
  if (!current) return { ok: false, error: "Abbonamento non trovato" };
  const { amount, paid_by, start_date, frequency, ...rest } = parsed.data;
  const startChanges = current.charges_count === 0 ? { ...(start_date ? { start_date } : {}), ...(frequency ? { frequency } : {}) } : {};
  const start = (startChanges as { start_date?: string }).start_date ?? current.start_date;
  if (rest.end_date && rest.end_date < start) {
    return { ok: false, error: "La fine viene prima dell'inizio.", fieldErrors: { end_date: ["Prima dell'inizio"] } };
  }
  const { paidBy } = await resolvePayer(paid_by);
  const { error } = await supabase
    .from("expense_subscriptions")
    .update({ ...rest, ...startChanges, amount_cents: amount!, paid_by: paidBy })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidateExpenses();
  return { ok: true, message: "Abbonamento aggiornato" };
}

/** Disdetta: nessun addebito dopo la data indicata (default oggi) */
export async function cancelSubscriptionAction(id: string, endDate?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const end = endDate || new Date().toISOString().slice(0, 10);
  const { data: s } = await supabase.from("expense_subscriptions").select("next_charge_date, start_date").eq("id", id).single();
  if (!s) return { ok: false, error: "Abbonamento non trovato" };
  const { error } = await supabase
    .from("expense_subscriptions")
    .update({ end_date: end < s.start_date ? s.start_date : end, active: s.next_charge_date <= end })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidateExpenses();
  return { ok: true, message: "Abbonamento disdetto: niente più addebiti" };
}

export async function deleteSubscriptionAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") return { ok: false, error: "Solo un amministratore può eliminare un abbonamento." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_subscriptions")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidateExpenses();
  return { ok: true, message: "Abbonamento eliminato (le spese già registrate restano)" };
}

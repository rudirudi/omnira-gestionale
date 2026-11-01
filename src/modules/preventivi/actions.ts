"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { convertLeadToClientAction } from "@/modules/lead/actions";

const SALES = ["admin", "amministrazione", "project_manager", "commerciale"] as const;
const FREQUENCY = z.enum(["mensile", "trimestrale", "semestrale", "annuale", "biennale"]);

function revalidateQuote(id?: string) {
  revalidatePath("/preventivi");
  if (id) revalidatePath(`/preventivi/${id}`);
  revalidatePath("/lead");
}

// ---------------------------------------------------------------------------
// Nuovo preventivo: titolo + destinatario ("client:<id>" o "lead:<id>")
// ---------------------------------------------------------------------------
const newSchema = z.object({
  title: z.string().trim().min(1, "Scrivi il titolo").max(200),
  recipient: z.string().regex(/^(client|lead):[0-9a-f-]{36}$/i, "Scegli il cliente o il lead"),
});

export async function createQuoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...SALES]);
  const parsed = newSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [kind, id] = parsed.data.recipient.split(":") as ["client" | "lead", string];
  const supabase = await createClient();

  let clientId: string | null = kind === "client" ? id : null;
  const leadId: string | null = kind === "lead" ? id : null;
  let intro: string | null = null;
  if (leadId) {
    const { data: lead } = await supabase.from("leads").select("client_id, service_interest, notes").eq("id", leadId).single();
    clientId = lead?.client_id ?? null;
    intro = lead?.service_interest ?? null;
  }
  const { data: company } = await supabase.from("company_settings").select("default_vat_rate").eq("id", 1).maybeSingle();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      title: parsed.data.title,
      client_id: clientId,
      lead_id: leadId,
      intro,
      vat_rate: company?.default_vat_rate ?? 22,
      terms: "Tempi di realizzazione da concordare all'avvio.\nI prezzi si intendono IVA esclusa.",
    })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  revalidateQuote();
  redirect(`/preventivi/${data.id}`);
}

// ---------------------------------------------------------------------------
// Salvataggio dall'editor: intestazione + tutte le voci
// ---------------------------------------------------------------------------
const itemSchema = z.object({
  description: z.string().trim().min(1, "Ogni voce ha bisogno di una descrizione").max(500),
  details: z.string().trim().max(4000).nullable().optional(),
  quantity: z.number().positive("Quantità maggiore di zero").max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  unit_price_cents: z.number().int().min(0).max(1_000_000_000),
  frequency: FREQUENCY.nullable(),
});
const saveSchema = z.object({
  title: z.string().trim().min(1, "Scrivi il titolo").max(200),
  issue_date: z.string().min(10),
  valid_until: z.string().min(10),
  intro: z.string().trim().max(8000).nullable(),
  terms: z.string().trim().max(8000).nullable(),
  vat_rate: z.number().min(0).max(100),
  discount_cents: z.number().int().min(0),
  deposit_pct: z.number().int().min(0).max(100),
  items: z.array(itemSchema).max(200),
});
export type QuotePayload = z.infer<typeof saveSchema>;

export async function saveQuoteAction(id: string, payload: QuotePayload): Promise<ActionResult> {
  await requireRole([...SALES]);
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati" };
  const { items, ...header } = parsed.data;
  if (header.valid_until < header.issue_date) return { ok: false, error: "La validità termina prima della data del preventivo." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("quotes").select("status").eq("id", z.guid().parse(id)).single();
  if (!current) return { ok: false, error: "Preventivo non trovato" };
  if (current.status === "accettato" || current.status === "rifiutato") return { ok: false, error: "Un preventivo chiuso non si modifica: duplicalo." };

  const { error } = await supabase
    .from("quotes")
    .update({ ...header, intro: header.intro || null, terms: header.terms || null })
    .eq("id", id);
  if (error) return fromDbError(error);
  const { error: delErr } = await supabase.from("quote_items").delete().eq("quote_id", id);
  if (delErr) return fromDbError(delErr);
  if (items.length) {
    const { error: insErr } = await supabase
      .from("quote_items")
      .insert(items.map((it, position) => ({ ...it, details: it.details || null, quote_id: id, position })));
    if (insErr) return fromDbError(insErr);
  }
  revalidateQuote(id);
  return { ok: true, message: "Preventivo salvato" };
}

// ---------------------------------------------------------------------------
// Cambi di stato
// ---------------------------------------------------------------------------
export async function markSentAction(id: string): Promise<ActionResult> {
  await requireRole([...SALES]);
  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("quotes")
    .update({ status: "inviato", sent_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .in("status", ["bozza", "inviato"])
    .select("lead_id")
    .single();
  if (error) return fromDbError(error);
  // Il lead avanza nella pipeline (senza tornare indietro)
  if (q.lead_id) await supabase.from("leads").update({ stage: "preventivo" }).eq("id", q.lead_id).in("stage", ["nuovo", "call", "analisi"]);
  revalidateQuote(id);
  return { ok: true, message: "Segnato come inviato: il lead è passato a «Preventivo inviato»" };
}

export async function backToDraftAction(id: string): Promise<ActionResult> {
  await requireRole([...SALES]);
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ status: "bozza", sent_at: null }).eq("id", z.guid().parse(id)).eq("status", "inviato");
  if (error) return fromDbError(error);
  revalidateQuote(id);
  return { ok: true, message: "Tornato in bozza" };
}

export async function refuseQuoteAction(id: string, reason: string): Promise<ActionResult> {
  await requireRole([...SALES]);
  const why = reason.trim();
  if (!why) return { ok: false, error: "Scrivi il motivo: serve per capire cosa migliorare." };
  const supabase = await createClient();
  const { data: q, error } = await supabase
    .from("quotes")
    .update({ status: "rifiutato", refused_reason: why, decided_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .in("status", ["bozza", "inviato"])
    .select("lead_id")
    .single();
  if (error) return fromDbError(error);
  if (q.lead_id) await supabase.from("leads").update({ stage: "perso", lost_reason: why }).eq("id", q.lead_id).not("stage", "in", "(vinto,perso)");
  revalidateQuote(id);
  return { ok: true, message: "Preventivo segnato come rifiutato" };
}

const acceptSchema = z.object({
  createProject: z.boolean(),
  projectType: z.enum(["sito", "ecommerce", "software", "app", "gestionale", "automazione_ai", "seo", "altro"]),
  createReceivables: z.boolean(),
  createRenewals: z.boolean(),
});

export async function acceptQuoteAction(id: string, options: z.infer<typeof acceptSchema>): Promise<ActionResult<{ projectId: string | null }>> {
  const user = await requireRole(["admin", "amministrazione", "project_manager"]);
  const opts = acceptSchema.parse(options);
  if (opts.createProject && !can.manageProjects(user.role)) {
    return { ok: false, error: "Solo un amministratore o un PM può creare il progetto: togli la spunta o chiedi a loro." };
  }
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("client_id, lead_id").eq("id", z.guid().parse(id)).single();
  if (!q) return { ok: false, error: "Preventivo non trovato" };

  // Preventivo fatto a un lead: prima diventa cliente
  if (!q.client_id && q.lead_id) {
    const conv = await convertLeadToClientAction(q.lead_id);
    if (!conv.ok || !conv.data) return { ok: false, error: conv.ok ? "Impossibile creare il cliente" : conv.error };
    const { error } = await supabase.from("quotes").update({ client_id: conv.data.clientId }).eq("id", id);
    if (error) return fromDbError(error) as ActionResult<{ projectId: string | null }>;
  }

  const { data, error } = await supabase.rpc("accept_quote", {
    p_id: id,
    p_create_project: opts.createProject,
    p_project_type: opts.projectType,
    p_create_receivables: opts.createReceivables,
    p_create_renewals: opts.createRenewals,
  });
  if (error) {
    if (error.message.includes("già")) return { ok: false, error: error.message };
    return fromDbError(error) as ActionResult<{ projectId: string | null }>;
  }
  revalidateQuote(id);
  revalidatePath("/progetti");
  revalidatePath("/incassi");
  revalidatePath("/scadenze");
  revalidatePath("/clienti");
  revalidatePath("/");
  const parts = [opts.createProject && "progetto creato", opts.createReceivables && "acconto e saldo negli incassi", opts.createRenewals && "canoni nelle scadenze"].filter(Boolean);
  return { ok: true, data: { projectId: data }, message: `Preventivo accettato${parts.length ? `: ${parts.join(", ")}` : ""}` };
}

export async function duplicateQuoteAction(id: string): Promise<ActionResult<{ id: string }>> {
  await requireRole([...SALES]);
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("*").eq("id", z.guid().parse(id)).single();
  if (!q) return { ok: false, error: "Preventivo non trovato" };
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("position");
  const today = new Date();
  const valid = new Date(today.getTime() + 30 * 86400000);
  const { data: copy, error } = await supabase
    .from("quotes")
    .insert({
      title: `${q.title} (copia)`,
      client_id: q.client_id,
      lead_id: q.lead_id,
      intro: q.intro,
      terms: q.terms,
      vat_rate: q.vat_rate,
      discount_cents: q.discount_cents,
      deposit_pct: q.deposit_pct,
      issue_date: today.toISOString().slice(0, 10),
      valid_until: valid.toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) return fromDbError(error) as ActionResult<{ id: string }>;
  if (items?.length) {
    await supabase.from("quote_items").insert(
      items.map(({ description, details, quantity, unit, unit_price_cents, frequency, position }) => ({
        quote_id: copy.id,
        description,
        details,
        quantity,
        unit,
        unit_price_cents,
        frequency,
        position,
      })),
    );
  }
  revalidateQuote();
  return { ok: true, data: { id: copy.id }, message: "Preventivo duplicato come bozza" };
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const user = await requireRole([...SALES]);
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("status").eq("id", z.guid().parse(id)).single();
  if (!q) return { ok: false, error: "Preventivo non trovato" };
  if (q.status !== "bozza" && user.role !== "admin") return { ok: false, error: "Si possono eliminare solo le bozze (o chiedi a un amministratore)." };
  const { error } = await supabase.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fromDbError(error);
  revalidateQuote();
  return { ok: true, message: "Preventivo eliminato" };
}

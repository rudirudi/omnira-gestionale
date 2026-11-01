"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, euroToCents, fromDbError, fromZodError, optionalText } from "@/lib/action-result";

const MONEY = ["admin", "amministrazione", "project_manager"] as const;

const renewalSchema = z.object({
  type: z.enum(["dominio", "hosting", "server", "ssl", "email", "licenza", "saas", "manutenzione", "altro"]),
  name: z.string().trim().min(1, "Scrivi il nome (es. il dominio)").max(200),
  client_id: optionalText,
  project_id: optionalText,
  provider: optionalText,
  frequency: z.enum(["mensile", "trimestrale", "semestrale", "annuale", "biennale"]).default("annuale"),
  next_due_date: z.string().min(1, "Inserisci la data di scadenza"),
  cost: euroToCents,
  price: euroToCents,
  auto_renew: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  notify_days_before: z.coerce.number().int().min(1, "Minimo 1 giorno").max(365).default(30),
  notes: optionalText,
});

function toRow(d: z.infer<typeof renewalSchema>) {
  const { cost, price, ...rest } = d;
  return { ...rest, cost_cents: cost, price_cents: price };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createRenewalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const parsed = renewalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("renewals").insert(toRow(parsed.data));
  if (error) return fromDbError(error);
  revalidateAll();
  return { ok: true, message: "Scadenza aggiunta: riceverai un avviso prima della data" };
}

export async function updateRenewalAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const parsed = renewalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("renewals").update(toRow(parsed.data)).eq("id", id);
  if (error) return fromDbError(error);
  revalidateAll();
  return { ok: true, message: "Scadenza aggiornata" };
}

/** Rinnovato: la scadenza passa al periodo successivo; facoltativo l'importo da far pagare al cliente */
export async function renewAction(id: string, createReceivable: boolean): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_renewal", { p_id: z.guid().parse(id), p_create_receivable: createReceivable });
  if (error) return fromDbError(error);
  revalidateAll();
  const next = new Date(`${data}T00:00:00`).toLocaleDateString("it-IT");
  return { ok: true, message: `Rinnovato: prossima scadenza ${next}${createReceivable ? " · importo aggiunto agli incassi" : ""}` };
}

export async function setRenewalActiveAction(id: string, active: boolean): Promise<ActionResult> {
  await requireRole([...MONEY]);
  const supabase = await createClient();
  const { error } = await supabase.from("renewals").update({ active }).eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidateAll();
  return { ok: true, message: active ? "Scadenza riattivata" : "Scadenza disattivata: niente più avvisi" };
}

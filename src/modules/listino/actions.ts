"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, euroToCents, fromDbError, fromZodError, optionalText } from "@/lib/action-result";

const SALES = ["admin", "amministrazione", "project_manager", "commerciale"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Scrivi il nome").max(200),
  description: optionalText,
  category: z.enum(["sito", "ecommerce", "software", "gestionale", "app", "automazione_ai", "seo", "grafica", "hosting", "assistenza", "altro"]),
  unit: z.string().trim().min(1).max(20),
  price: euroToCents,
  frequency: z
    .enum(["una_tantum", "mensile", "trimestrale", "semestrale", "annuale", "biennale"])
    .transform((v) => (v === "una_tantum" ? null : v)),
});

function toRow(d: z.infer<typeof schema>) {
  const { price, ...rest } = d;
  return { ...rest, price_cents: price };
}

function revalidate() {
  revalidatePath("/listino");
  revalidatePath("/preventivi", "layout");
}

export async function createServiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...SALES]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({ ...toRow(parsed.data), position: 999 });
  if (error) return fromDbError(error);
  revalidate();
  return { ok: true, message: "Servizio aggiunto al listino" };
}

export async function updateServiceAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...SALES]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(toRow(parsed.data)).eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidate();
  return { ok: true, message: "Servizio aggiornato" };
}

export async function setServiceActiveAction(id: string, active: boolean): Promise<ActionResult> {
  await requireRole([...SALES]);
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ active }).eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidate();
  return { ok: true, message: active ? "Servizio riattivato" : "Servizio nascosto dai preventivi" };
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  await requireRole([...SALES]);
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ deleted_at: new Date().toISOString() }).eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  revalidate();
  return { ok: true, message: "Servizio eliminato dal listino" };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { leadSchema, moveSchema } from "./schema";

const EDITORS = ["admin", "project_manager", "commerciale"] as const;

function toRow(data: ReturnType<typeof leadSchema.parse>) {
  const { estimated_value, ...rest } = data;
  return { ...rest, estimated_value_cents: estimated_value };
}

export async function createLeadAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  // In cima alla colonna "Nuovo"
  const { data: first } = await supabase
    .from("leads")
    .select("position")
    .eq("stage", "nuovo")
    .is("deleted_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("leads").insert({ ...toRow(parsed.data), position: (first?.position ?? 1) - 1 });
  if (error) return fromDbError(error);
  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true, message: "Lead creato" };
}

export async function updateLeadAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(toRow(parsed.data)).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/lead");
  return { ok: true, message: "Lead aggiornato" };
}

export async function moveLeadAction(input: {
  id: string;
  stage: string;
  position: number;
  lost_reason?: string;
}): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const { id, stage, position, lost_reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage, position, lost_reason: stage === "perso" ? lost_reason : null })
    .eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true };
}

/** Lead vinto → crea il cliente (o collega quello esistente con lo stesso nome). */
export async function convertLeadToClientAction(id: string): Promise<ActionResult<{ clientId: string }>> {
  await requireRole(["admin", "project_manager", "commerciale", "amministrazione"]);
  const supabase = await createClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error || !lead) return { ok: false, error: "Lead non trovato" };
  if (lead.client_id) return { ok: true, data: { clientId: lead.client_id } };

  const name = lead.company_name || lead.contact_name || lead.title;
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  let clientId = existing?.id;
  if (!clientId) {
    const { data: created, error: insErr } = await supabase
      .from("clients")
      .insert({ name, email: lead.email, phone: lead.phone, owner_id: lead.owner_id, status: "attivo" })
      .select("id")
      .single();
    if (insErr) return fromDbError(insErr) as ActionResult<{ clientId: string }>;
    clientId = created.id;
    if (lead.contact_name) {
      const [first, ...rest] = lead.contact_name.split(" ");
      await supabase.from("contacts").insert({
        client_id: clientId,
        first_name: first ?? lead.contact_name,
        last_name: rest.join(" ") || null,
        email: lead.email,
        phone: lead.phone,
        is_primary: true,
      });
    }
  }
  await supabase.from("leads").update({ client_id: clientId, stage: "vinto" }).eq("id", id);
  revalidatePath("/lead");
  revalidatePath("/clienti");
  return { ok: true, data: { clientId }, message: "Cliente creato dal lead" };
}

export async function fetchLeadActivitiesAction(leadId: string) {
  const { getLeadActivities } = await import("./queries");
  return getLeadActivities(leadId);
}

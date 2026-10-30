"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { activitySchema, clientSchema, contactSchema } from "./schema";

const EDITORS = ["admin", "project_manager", "commerciale", "amministrazione"] as const;

export async function createClientAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(parsed.data).select("id").single();
  if (error) return fromDbError(error);
  revalidatePath("/clienti");
  redirect(`/clienti/${data.id}`);
}

export async function updateClientAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/clienti/${id}`);
  revalidatePath("/clienti");
  return { ok: true, message: "Modifiche salvate" };
}

/** Archiviazione (cancellazione logica): il cliente resta nello storico. */
export async function archiveClientAction(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/clienti");
  redirect("/clienti");
}

export async function addContactAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  if (parsed.data.is_primary) {
    await supabase.from("contacts").update({ is_primary: false }).eq("client_id", parsed.data.client_id);
  }
  const { error } = await supabase.from("contacts").insert(parsed.data);
  if (error) return fromDbError(error);
  revalidatePath(`/clienti/${parsed.data.client_id}`);
  return { ok: true, message: "Referente aggiunto" };
}

export async function deleteContactAction(id: string, clientId: string): Promise<ActionResult> {
  await requireRole([...EDITORS]);
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/clienti/${clientId}`);
  return { ok: true };
}

export async function addActivityAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione scaduta, accedi di nuovo." };

  const raw = Object.fromEntries(formData);
  const parsed = activitySchema.safeParse({
    ...raw,
    client_id: raw.client_id || undefined,
    lead_id: raw.lead_id || undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const { error } = await supabase.from("activities").insert({
    ...parsed.data,
    due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
    created_by: user.id,
  });
  if (error) return fromDbError(error);
  if (parsed.data.client_id) revalidatePath(`/clienti/${parsed.data.client_id}`);
  revalidatePath("/lead");
  revalidatePath("/");
  return { ok: true, message: "Attività registrata" };
}

export async function toggleActivityDoneAction(id: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

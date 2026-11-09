"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError, optionalText } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" || v === "nessuno" ? null : v))
  .pipe(z.guid().nullable())
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const schema = z.object({
  kind: z.enum(["punto", "discussione"]).default("punto"),
  title: z.string().trim().min(3, "Scrivi un titolo (almeno 3 caratteri)").max(200, "Titolo troppo lungo"),
  body: optionalText.optional().transform((v) => v ?? null).pipe(z.string().max(10000, "Testo troppo lungo").nullable()),
  priority: z.enum(["bassa", "normale", "alta"]).default("normale"),
  owner_id: optionalId,
  project_id: optionalId,
  client_id: optionalId,
  due_date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.iso.date("Data non valida").nullable()),
});

function refresh(id?: string) {
  revalidatePath("/discussioni");
  revalidatePath("/");
  if (id) revalidatePath(`/discussioni/${id}`);
}

export async function createDiscussionAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussions")
    .insert({ ...parsed.data, created_by: me.id })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  refresh();
  redirect(`/discussioni/${data.id}`);
}

export async function updateDiscussionAction(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("discussions").update(parsed.data).eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  refresh(id);
  return { ok: true, message: "Salvato" };
}

export async function setDiscussionStatusAction(id: string, status: "aperto" | "risolto", resolution?: string): Promise<ActionResult> {
  await getCurrentUser();
  const text = resolution?.trim() || null;
  if (text && text.length > 4000) return { ok: false, error: "Esito troppo lungo" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("discussions")
    .update(status === "risolto" ? { status, resolution: text } : { status })
    .eq("id", z.guid().parse(id));
  if (error) return fromDbError(error);
  refresh(id);
  return { ok: true, message: status === "risolto" ? "Segnato come risolto" : "Riaperto" };
}

export async function deleteDiscussionAction(id: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("discussions").update({ deleted_at: new Date().toISOString() }).eq("id", z.guid().parse(id));
  if (error) return { ok: false, error: error.message.includes("Solo chi") ? "Solo chi l'ha aperto o un amministratore può eliminarlo." : "Eliminazione non riuscita." };
  refresh();
  redirect("/discussioni");
}

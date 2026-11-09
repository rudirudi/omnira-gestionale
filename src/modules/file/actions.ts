"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "project-files";
const CATEGORIES = ["documento", "grafica", "contratto", "materiale_cliente", "tecnico", "altro"] as const;

/** Dopo il caricamento (fatto dal browser direttamente nello spazio file) si salvano i dati del file */
export async function registerFileAction(
  projectId: string,
  file: { path: string; name: string; size: number; mime: string | null; category: (typeof CATEGORIES)[number] },
): Promise<ActionResult> {
  const me = await getCurrentUser();
  const pid = z.guid().parse(projectId);
  const f = z
    .object({
      path: z.string().startsWith(`${pid}/`).max(400),
      name: z.string().trim().min(1).max(255),
      size: z.number().int().min(0).max(52_428_800),
      mime: z.string().max(200).nullable(),
      category: z.enum(CATEGORIES),
    })
    .parse(file);
  const supabase = await createClient();
  const { error } = await supabase.from("project_files").insert({
    project_id: pid,
    path: f.path,
    name: f.name,
    size_bytes: f.size,
    mime: f.mime,
    category: f.category,
    uploaded_by: me.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([f.path]);
    return fromDbError(error);
  }
  revalidatePath(`/progetti/${pid}`);
  return { ok: true };
}

/** Link temporaneo (1 minuto) per aprire o scaricare un file */
export async function fileUrlAction(id: string, download: boolean): Promise<ActionResult<string>> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: f } = await supabase.from("project_files").select("path, name").eq("id", z.guid().parse(id)).maybeSingle();
  if (!f) return { ok: false, error: "File non trovato" };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 60, download ? { download: f.name } : undefined);
  if (error || !data) return { ok: false, error: "Non riesco ad aprire il file. Riprova." };
  return { ok: true, data: data.signedUrl };
}

export async function updateFileAction(id: string, patch: { category?: (typeof CATEGORIES)[number]; note?: string | null }): Promise<ActionResult> {
  await getCurrentUser();
  const p = z.object({ category: z.enum(CATEGORIES).optional(), note: z.string().trim().max(500).nullable().optional() }).parse(patch);
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_files").update(p).eq("id", z.guid().parse(id)).select("project_id").single();
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${data.project_id}`);
  return { ok: true };
}

export async function deleteFileAction(id: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: f } = await supabase.from("project_files").select("path, project_id").eq("id", z.guid().parse(id)).maybeSingle();
  if (!f) return { ok: false, error: "File non trovato" };
  const { data: gone, error } = await supabase.from("project_files").delete().eq("id", id).select("id");
  if (error) return fromDbError(error);
  if (!gone?.length) return { ok: false, error: "Può eliminarlo solo chi l'ha caricato o un amministratore." };
  await supabase.storage.from(BUCKET).remove([f.path]);
  revalidatePath(`/progetti/${f.project_id}`);
  return { ok: true, message: "File eliminato" };
}

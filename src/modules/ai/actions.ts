"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// Una chiave o una password non va mai salvata in un prompt
const SECRET = /(sk-[a-z0-9_-]{10,}|re_[a-z0-9]{10,}|ghp_[a-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|eyJ[a-zA-Z0-9_-]{20,}\.|-----BEGIN|password\s*[:=]\s*\S+)/i;
const SECRET_MSG = "Sembra che ci sia una chiave o una password: non salvarla qui";
const noSecrets = (v: string | null) => !v || !SECRET.test(v);

const KIND = z.enum(["system", "prompt", "agente", "template", "estrazione", "altro"]);
const STATUS = z.enum(["bozza", "in_test", "in_produzione", "archiviato"]);

const versionSchema = z.object({
  label: text(120),
  body: z.string().trim().min(1, "Scrivi il testo del prompt").max(100000, "Massimo 100.000 caratteri").refine(noSecrets, SECRET_MSG),
  model: text(120),
  temperature: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))))
    .pipe(z.number("Numero non valido").min(0, "Da 0 a 2").max(2, "Da 0 a 2").nullable()),
  max_tokens: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/\./g, ""))))
    .pipe(z.number("Numero non valido").int("Numero intero").min(1).max(1000000).nullable()),
  change_note: text(2000).refine(noSecrets, SECRET_MSG),
});

const promptSchema = z.object({
  title: z.string().trim().min(1, "Dai un nome al prompt").max(160),
  kind: KIND,
  purpose: text(1000).refine(noSecrets, SECRET_MSG),
});

export async function createPromptAction(
  projectId: string,
  input: z.input<typeof promptSchema> & { version: z.input<typeof versionSchema> },
): Promise<ActionResult<string>> {
  await getCurrentUser();
  const p = promptSchema.safeParse(input);
  const v = versionSchema.safeParse(input.version);
  if (!p.success) return fromZodError(p.error) as ActionResult<string>;
  if (!v.success) return fromZodError(v.error) as ActionResult<string>;
  const pid = z.guid().parse(projectId);
  const supabase = await createClient();
  const { data: prompt, error } = await supabase.from("ai_prompts").insert({ ...p.data, project_id: pid }).select("id").single();
  if (error || !prompt) return fromDbError(error ?? { message: "insert" }) as ActionResult<string>;
  const { error: e2 } = await supabase.from("ai_prompt_versions").insert({ ...v.data, prompt_id: prompt.id, label: v.data.label ?? "Prima versione" });
  if (e2) {
    await supabase.from("ai_prompts").delete().eq("id", prompt.id);
    return fromDbError(e2) as ActionResult<string>;
  }
  revalidatePath(`/progetti/${pid}`);
  return { ok: true, data: prompt.id, message: "Prompt creato" };
}

export async function updatePromptAction(projectId: string, promptId: string, input: z.input<typeof promptSchema>): Promise<ActionResult> {
  await getCurrentUser();
  const p = promptSchema.safeParse(input);
  if (!p.success) return fromZodError(p.error);
  const supabase = await createClient();
  const { error } = await supabase.from("ai_prompts").update(p.data).eq("id", z.guid().parse(promptId));
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Prompt aggiornato" };
}

export async function setPromptStatusAction(projectId: string, promptId: string, status: z.input<typeof STATUS>): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_prompts").update({ status: STATUS.parse(status) }).eq("id", z.guid().parse(promptId));
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true };
}

export async function deletePromptAction(projectId: string, promptId: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const id = z.guid().parse(promptId);
  const { error } = await supabase.from("ai_prompts").delete().eq("id", id);
  if (error) return fromDbError(error);
  await supabase.from("comments").delete().eq("entity_type", "ai_prompt").eq("entity_id", id);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Prompt eliminato" };
}

export async function addVersionAction(projectId: string, promptId: string, input: z.input<typeof versionSchema>): Promise<ActionResult<string>> {
  await getCurrentUser();
  const v = versionSchema.safeParse(input);
  if (!v.success) return fromZodError(v.error) as ActionResult<string>;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_prompt_versions")
    .insert({ ...v.data, prompt_id: z.guid().parse(promptId) })
    .select("id, number")
    .single();
  if (error || !data) return fromDbError(error ?? { message: "insert" }) as ActionResult<string>;
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, data: data.id, message: `Variante v${data.number} salvata` };
}

const resultSchema = z.object({
  result: text(10000).refine(noSecrets, SECRET_MSG),
  rating: z.number().int().min(1).max(5).nullable(),
});

export async function saveVersionResultAction(projectId: string, versionId: string, input: z.input<typeof resultSchema>): Promise<ActionResult> {
  await getCurrentUser();
  const r = resultSchema.safeParse(input);
  if (!r.success) return fromZodError(r.error);
  const supabase = await createClient();
  const { error } = await supabase.from("ai_prompt_versions").update(r.data).eq("id", z.guid().parse(versionId));
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Esito salvato" };
}

/** Segna una versione come quella in produzione (null = nessuna) */
export async function setProductionAction(projectId: string, promptId: string, versionId: string | null): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const patch = versionId
    ? { production_version_id: z.guid().parse(versionId), status: "in_produzione" as const }
    : { production_version_id: null, status: "in_test" as const };
  const { error } = await supabase.from("ai_prompts").update(patch).eq("id", z.guid().parse(promptId));
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: versionId ? "Versione messa in produzione" : "Nessuna versione in produzione" };
}

export async function deleteVersionAction(projectId: string, versionId: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const id = z.guid().parse(versionId);
  const { data: v } = await supabase.from("ai_prompt_versions").select("prompt_id").eq("id", id).single();
  if (!v) return { ok: false, error: "Versione non trovata" };
  const { count } = await supabase.from("ai_prompt_versions").select("id", { count: "exact", head: true }).eq("prompt_id", v.prompt_id);
  if ((count ?? 0) <= 1) return { ok: false, error: "È l'unica versione: elimina il prompt intero" };
  const { error } = await supabase.from("ai_prompt_versions").delete().eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Variante eliminata" };
}

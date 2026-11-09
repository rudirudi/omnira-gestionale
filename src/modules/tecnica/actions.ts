"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const url = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .pipe(z.url("Indirizzo non valido").nullable());
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .optional()
    .transform((v) => (v ? v : null));
const tags = z
  .array(z.string().trim().min(1).max(60))
  .max(60)
  .transform((a) => [...new Map(a.map((v) => [v.toLowerCase(), v])).values()]);

// Una chiave o una password non va mai salvata qui
const SECRET = /(sk-[a-z0-9]{10,}|re_[a-z0-9]{10,}|ghp_[a-z0-9]{20,}|eyJ[a-zA-Z0-9_-]{20,}\.|-----BEGIN|password\s*[:=]\s*\S+)/i;
const noSecrets = (v: string | null) => !v || !SECRET.test(v);

const techSchema = z.object({
  stack: tags,
  patterns: tags,
  repo_url: url,
  prod_url: url,
  staging_url: url,
  notes: text(20000).refine(noSecrets, "Sembra che ci sia una chiave o una password: non salvarla qui"),
});

export async function saveTechAction(projectId: string, input: z.input<typeof techSchema>): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = techSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_tech")
    .upsert({ project_id: z.guid().parse(projectId), ...parsed.data, updated_by: me.id }, { onConflict: "project_id" });
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Scheda tecnica salvata" };
}

const serviceSchema = z.object({
  provider: z.string().trim().min(1, "Scrivi il nome del fornitore").max(80),
  category: z.enum(["hosting", "database", "dominio", "email", "ai", "pagamenti", "storage", "analytics", "monitoraggio", "repository", "altro"]),
  purpose: text(300),
  dashboard_url: url,
  account: text(200).refine(noSecrets, "Niente password qui: solo l'account o l'email di riferimento"),
  plan: text(120),
  owner: z.enum(["omnira", "cliente"]),
  notes: text(2000).refine(noSecrets, "Sembra che ci sia una chiave o una password: non salvarla qui"),
});

export async function saveServiceAction(projectId: string, serviceId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = serviceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const pid = z.guid().parse(projectId);
  const { error } = serviceId
    ? await supabase.from("project_services").update(parsed.data).eq("id", z.guid().parse(serviceId))
    : await supabase.from("project_services").insert({ ...parsed.data, project_id: pid });
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${pid}`);
  return { ok: true, message: serviceId ? "Servizio aggiornato" : "Servizio aggiunto" };
}

export async function deleteServiceAction(projectId: string, serviceId: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("project_services").delete().eq("id", z.guid().parse(serviceId));
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true, message: "Servizio rimosso" };
}

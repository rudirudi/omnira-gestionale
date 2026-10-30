"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError } from "@/lib/action-result";
import { projectRow, projectSchema } from "./schema";
import { PROJECT_TEMPLATES } from "./templates";

const MANAGERS = ["admin", "project_manager"] as const;

export async function createProjectAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireRole([...MANAGERS]);
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const row = projectRow(parsed.data);
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ ...row, manager_id: row.manager_id ?? me.id })
    .select("id, type")
    .single();
  if (error) return fromDbError(error);

  if (parsed.data.use_template) {
    const template = PROJECT_TEMPLATES[project.type];
    const { data: phases } = await supabase
      .from("project_phases")
      .select("id, name, position")
      .eq("project_id", project.id)
      .order("position");
    const rows = (phases ?? []).flatMap((ph) =>
      (template[ph.name as keyof typeof template] ?? []).map((title, i) => ({
        project_id: project.id,
        phase_id: ph.id,
        title,
        // ordine sulla board: prima tutti i task di Analisi, poi Progettazione, ecc.
        position: ph.position * 100 + i,
      })),
    );
    if (rows.length) await supabase.from("tasks").insert(rows);
  }
  revalidatePath("/progetti");
  redirect(`/progetti/${project.id}`);
}

export async function updateProjectAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(projectRow(parsed.data)).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${id}`);
  revalidatePath("/progetti");
  return { ok: true, message: "Progetto aggiornato" };
}

export async function archiveProjectAction(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/progetti");
  redirect("/progetti");
}

export async function updatePhaseAction(input: {
  id: string;
  projectId: string;
  status?: "da_iniziare" | "in_corso" | "completata";
  start_date?: string | null;
  due_date?: string | null;
}): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const { id, projectId, ...patch } = input;
  const supabase = await createClient();
  const { error } = await supabase.from("project_phases").update(patch).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true };
}

const milestoneSchema = z.object({
  project_id: z.guid(),
  title: z.string().trim().min(1, "Scrivi un titolo"),
  due_date: z.string().min(1, "Scegli una data"),
});

export async function addMilestoneAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert(parsed.data);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${parsed.data.project_id}`);
  return { ok: true, message: "Milestone aggiunta" };
}

export async function toggleMilestoneAction(id: string, projectId: string, done: boolean): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true };
}

export async function deleteMilestoneAction(id: string, projectId: string): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true };
}

export async function setMemberAction(projectId: string, userId: string, member: boolean): Promise<ActionResult> {
  await requireRole([...MANAGERS]);
  const supabase = await createClient();
  const { error } = member
    ? await supabase.from("project_members").upsert({ project_id: projectId, user_id: userId })
    : await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) return fromDbError(error);
  revalidatePath(`/progetti/${projectId}`);
  return { ok: true };
}

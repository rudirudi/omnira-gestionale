"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError, optionalText } from "@/lib/action-result";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { getTaskDetail } from "./queries";

const STATUSES = ["da_fare", "in_corso", "in_review", "test", "fatto"] as const;
const PRIORITIES = ["bassa", "media", "alta", "urgente"] as const;

function revalidateTaskViews(projectId?: string) {
  revalidatePath("/task");
  revalidatePath("/");
  if (projectId) revalidatePath(`/progetti/${projectId}`);
  revalidatePath("/progetti");
}

const createSchema = z.object({
  project_id: z.guid("Scegli un progetto"),
  title: z.string().trim().min(1, "Scrivi il titolo del task").max(300),
  phase_id: optionalText,
  parent_id: optionalText,
  status: z.enum(STATUSES).default("da_fare"),
  priority: z.enum(PRIORITIES).default("media"),
  due_date: optionalText,
  assign_to_me: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function createTaskAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { assign_to_me, ...row } = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", row.project_id)
    .eq("status", row.status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...row, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  if (assign_to_me) await supabase.from("task_assignees").insert({ task_id: data.id, user_id: me.id });
  revalidateTaskViews(row.project_id);
  return { ok: true, message: "Task creato" };
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(20000).nullable(),
    status: z.enum(STATUSES),
    priority: z.enum(PRIORITIES),
    due_date: z.string().nullable(),
    start_date: z.string().nullable(),
    estimate_hours: z.number().min(0).max(9999).nullable(),
    phase_id: z.string().nullable(),
    position: z.number(),
  })
  .partial();

export async function updateTaskAction(id: string, patch: z.input<typeof patchSchema>): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(parsed.data).eq("id", id).select("project_id").single();
  if (error) return fromDbError(error);
  revalidateTaskViews(data.project_id);
  return { ok: true };
}

export async function moveTaskAction(id: string, status: TaskStatus, position: number): Promise<ActionResult> {
  return updateTaskAction(id, { status, position });
}

export async function setAssigneesAction(taskId: string, userIds: string[]): Promise<ActionResult> {
  await getCurrentUser();
  const ids = z.array(z.guid()).max(20).parse(userIds);
  const supabase = await createClient();
  const { data: current } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
  const now = new Set((current ?? []).map((c) => c.user_id));
  const toAdd = ids.filter((i) => !now.has(i));
  const toRemove = [...now].filter((i) => !ids.includes(i));
  if (toRemove.length) {
    const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).in("user_id", toRemove);
    if (error) return fromDbError(error);
  }
  if (toAdd.length) {
    const { error } = await supabase.from("task_assignees").insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
    if (error) return fromDbError(error);
  }
  revalidateTaskViews();
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  await requireRole(["admin", "project_manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("project_id")
    .single();
  if (error) return fromDbError(error);
  revalidateTaskViews(data.project_id);
  return { ok: true, message: "Task eliminato" };
}

export async function fetchTaskDetailAction(id: string) {
  // Nessun controllo extra: la lettura passa dalle regole RLS del database
  return getTaskDetail(z.guid().parse(id));
}

export async function quickAddSubtaskAction(parentId: string, title: string): Promise<ActionResult> {
  await getCurrentUser();
  const t = title.trim();
  if (!t) return { ok: false, error: "Scrivi il titolo" };
  const supabase = await createClient();
  const { data: parent } = await supabase.from("tasks").select("project_id, phase_id").eq("id", parentId).single();
  if (!parent) return { ok: false, error: "Task non trovato" };
  const { error } = await supabase
    .from("tasks")
    .insert({ project_id: parent.project_id, phase_id: parent.phase_id, parent_id: parentId, title: t, position: Date.now() / 1e12 });
  if (error) return fromDbError(error);
  revalidateTaskViews(parent.project_id);
  return { ok: true };
}

export type TaskPatch = { status?: TaskStatus; priority?: TaskPriority };

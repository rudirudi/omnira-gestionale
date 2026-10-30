import "server-only";
import { createClient } from "@/lib/supabase/server";

const TASK_SELECT =
  "*, project:projects(id, code, name), phase:project_phases(id, name), assignees:task_assignees(user_id, profile:profiles!task_assignees_user_id_fkey(id, full_name))";

export async function listProjectTasks(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .is("parent_id", null)
    .order("position")
    .order("number");
  if (error) throw new Error(error.message);
  return withSubtaskCounts(data);
}

/** Task del team o solo quelli assegnati a me. */
export async function listTasks({ userId, mine }: { userId: string; mine: boolean }) {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .is("parent_id", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (mine) {
    const { data: mineIds } = await supabase.from("task_assignees").select("task_id").eq("user_id", userId);
    const ids = (mineIds ?? []).map((r) => r.task_id);
    if (ids.length === 0) return [];
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return withSubtaskCounts(data);
}

async function withSubtaskCounts<T extends { id: string }>(tasks: T[]) {
  if (tasks.length === 0) return [] as (T & { subtasks: { total: number; done: number } })[];
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("tasks")
    .select("parent_id, status")
    .in("parent_id", tasks.map((t) => t.id))
    .is("deleted_at", null);
  const counts = new Map<string, { total: number; done: number }>();
  for (const s of subs ?? []) {
    const c = counts.get(s.parent_id!) ?? { total: 0, done: 0 };
    c.total++;
    if (s.status === "fatto") c.done++;
    counts.set(s.parent_id!, c);
  }
  return tasks.map((t) => ({ ...t, subtasks: counts.get(t.id) ?? { total: 0, done: 0 } }));
}
export type TaskListItem = Awaited<ReturnType<typeof listProjectTasks>>[number];

export async function getTaskDetail(id: string) {
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!task) return null;
  const [subtasks, phases] = await Promise.all([
    supabase.from("tasks").select("id, title, status, number").eq("parent_id", id).is("deleted_at", null).order("position").order("number"),
    supabase.from("project_phases").select("id, name").eq("project_id", task.project_id).order("position"),
  ]);
  return { ...task, subtaskList: subtasks.data ?? [], phases: phases.data ?? [] };
}
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

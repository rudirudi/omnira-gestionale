import "server-only";
import { createClient } from "@/lib/supabase/server";

const TASK_SELECT =
  "*, project:projects(id, code, name), phase:project_phases(id, name), assignees:task_assignees(user_id, profile:profiles!task_assignees_user_id_fkey(id, full_name)), children:tasks!parent_id(status, deleted_at)";

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
  const q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .is("parent_id", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (mine) {
    // join interno: solo i task che hanno me tra gli assegnatari
    const { data, error } = await supabase
      .from("tasks")
      .select(`${TASK_SELECT}, me:task_assignees!inner(user_id)`)
      .eq("me.user_id", userId)
      .is("deleted_at", null)
      .is("parent_id", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return withSubtaskCounts(data);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return withSubtaskCounts(data);
}

/** Conta i sotto-task dai figli già inclusi nella query (nessuna query in più) */
function withSubtaskCounts<T extends { children: { status: string; deleted_at: string | null }[] }>(tasks: T[]) {
  return tasks.map(({ children, ...t }) => {
    const live = children.filter((c) => !c.deleted_at);
    return { ...t, subtasks: { total: live.length, done: live.filter((c) => c.status === "fatto").length } };
  });
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

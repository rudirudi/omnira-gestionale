import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/database.types";

export async function listProjects({ status, mine, userId }: { status?: ProjectStatus | "aperti"; mine?: boolean; userId: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("projects")
    .select("*, client:clients(id, name), manager:profiles!projects_manager_id_fkey(id, full_name), members:project_members(user_id)")
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (status === "aperti") q = q.in("status", ["pianificato", "attivo", "in_pausa"]);
  else if (status) q = q.eq("status", status);
  const { data, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  const projects = mine ? data.filter((p) => p.manager_id === userId || p.members.some((m) => m.user_id === userId)) : data;

  const ids = projects.map((p) => p.id);
  const { data: progress } = ids.length
    ? await supabase.from("project_progress").select("*").in("project_id", ids)
    : { data: [] };
  const byId = new Map((progress ?? []).map((r) => [r.project_id, r]));
  return projects.map((p) => ({ ...p, progress: byId.get(p.id) ?? null }));
}
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, client:clients(id, name), manager:profiles!projects_manager_id_fkey(id, full_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return null;

  const [phases, milestones, members, progress] = await Promise.all([
    supabase.from("project_phases").select("*").eq("project_id", id).order("position"),
    supabase.from("milestones").select("*").eq("project_id", id).order("due_date"),
    supabase.from("project_members").select("user_id, added_at, profile:profiles(id, full_name, email, job_title, role)").eq("project_id", id),
    supabase.from("project_progress").select("*").eq("project_id", id).maybeSingle(),
  ]);
  return {
    ...project,
    phases: phases.data ?? [],
    milestones: milestones.data ?? [],
    members: (members.data ?? []).flatMap((m) => (m.profile ? [m.profile] : [])),
    progress: progress.data,
  };
}
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export async function listClientOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name").is("deleted_at", null).neq("status", "inattivo").order("name");
  return data ?? [];
}

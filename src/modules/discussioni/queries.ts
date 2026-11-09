import "server-only";
import type { DiscussionKind, DiscussionStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const SELECT =
  "*, owner:profiles!discussions_owner_id_fkey(id, full_name), author:profiles!discussions_created_by_fkey(id, full_name), project:projects(id, name, code), client:clients(id, name)";

const PRIORITY_RANK = { alta: 0, normale: 1, bassa: 2 } as const;

export async function listDiscussions(opts: { status?: DiscussionStatus; kind?: DiscussionKind; mineId?: string; projectId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("discussions").select(SELECT).is("deleted_at", null).order("last_activity_at", { ascending: false }).limit(300);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.mineId) q = q.or(`owner_id.eq.${opts.mineId},created_by.eq.${opts.mineId}`);
  const { data } = await q;
  // Prima gli aperti (per priorità), poi i risolti; a parità, i più movimentati di recente
  return (data ?? []).sort(
    (a, b) =>
      Number(a.status === "risolto") - Number(b.status === "risolto") ||
      (a.status === "aperto" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : 0) ||
      b.last_activity_at.localeCompare(a.last_activity_at),
  );
}
export type DiscussionListItem = Awaited<ReturnType<typeof listDiscussions>>[number];

export async function getDiscussion(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("discussions")
    .select(`${SELECT}, resolver:profiles!discussions_resolved_by_fkey(id, full_name)`)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}
export type DiscussionDetail = NonNullable<Awaited<ReturnType<typeof getDiscussion>>>;

/** Per la dashboard: i punti aperti, prima quelli di cui sono responsabile */
export async function listOpenForDashboard(userId: string) {
  const rows = await listDiscussions({ status: "aperto" });
  const today = new Date().toISOString().slice(0, 10);
  const score = (d: DiscussionListItem) =>
    (d.owner_id === userId ? 0 : 10) + (d.due_date && d.due_date < today ? 0 : 5) + PRIORITY_RANK[d.priority];
  const sorted = [...rows].sort((a, b) => score(a) - score(b) || b.last_activity_at.localeCompare(a.last_activity_at));
  return { total: rows.length, mine: rows.filter((d) => d.owner_id === userId).length, items: sorted.slice(0, 6) };
}

export async function listProjectOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, code").is("deleted_at", null).order("created_at", { ascending: false });
  return (data ?? []).map((p) => ({ id: p.id, name: p.code ? `${p.code} · ${p.name}` : p.name }));
}

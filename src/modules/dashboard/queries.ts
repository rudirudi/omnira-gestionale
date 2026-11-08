import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardData(userId: string, withMoney = false) {
  const supabase = await createClient();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const [clients, openLeads, wonMonth, dueActivities, recentLeads, activeProjects, myTasks, renewals, receivables, openTasks] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "attivo").is("deleted_at", null),
    supabase.from("leads").select("estimated_value_cents, stage").is("deleted_at", null).not("stage", "in", "(vinto,perso)"),
    supabase.from("leads").select("estimated_value_cents").eq("stage", "vinto").gte("closed_at", monthStart).is("deleted_at", null),
    supabase
      .from("activities")
      .select("id, subject, type, due_at, client:clients(id, name), lead_id, created_by")
      .is("done_at", null)
      .not("due_at", "is", null)
      .lte("due_at", in7)
      .order("due_at")
      .limit(8),
    supabase
      .from("leads")
      .select("id, title, company_name, stage, estimated_value_cents, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "attivo").is("deleted_at", null),
    supabase
      .from("tasks")
      .select("id, title, number, status, priority, due_date, project:projects(id, code, name), me:task_assignees!inner(user_id)")
      .eq("me.user_id", userId)
      .is("deleted_at", null)
      .neq("status", "fatto")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("renewals")
      .select("id, name, type, next_due_date, price_cents, client:clients(name)")
      .eq("active", true)
      .is("deleted_at", null)
      .lte("next_due_date", in30)
      .order("next_due_date")
      .limit(8),
    withMoney
      ? supabase.from("receivables").select("amount_cents, due_date, payments(amount_cents)").is("deleted_at", null)
      : Promise.resolve({ data: [] as { amount_cents: number; due_date: string | null; payments: { amount_cents: number }[] }[] }),
    // Task aperti per trovare quelli senza nessuno assegnato
    supabase
      .from("tasks")
      .select("id, title, number, status, priority, due_date, project:projects(id, code, name), assignees:task_assignees(user_id)")
      .is("deleted_at", null)
      .neq("status", "fatto")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const unassigned = (openTasks.data ?? []).filter((t) => t.assignees.length === 0);
  const today = now.toISOString().slice(0, 10);
  let toCollect = 0;
  let overdue = 0;
  for (const r of receivables.data ?? []) {
    const rem = Math.max(0, r.amount_cents - r.payments.reduce((s, p) => s + p.amount_cents, 0));
    toCollect += rem;
    if (rem && r.due_date && r.due_date < today) overdue += rem;
  }

  const pipeline = (openLeads.data ?? []).reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0);
  const byStage = new Map<string, { count: number; value: number }>();
  for (const l of openLeads.data ?? []) {
    const c = byStage.get(l.stage) ?? { count: 0, value: 0 };
    c.count++;
    c.value += l.estimated_value_cents ?? 0;
    byStage.set(l.stage, c);
  }
  const won = (wonMonth.data ?? []).reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0);
  const due = dueActivities.data ?? [];

  return {
    activeClients: clients.count ?? 0,
    openLeads: openLeads.data?.length ?? 0,
    pipelineCents: pipeline,
    wonMonthCents: won,
    wonMonthCount: wonMonth.data?.length ?? 0,
    due,
    myDue: due.filter((a) => a.created_by === userId).length,
    recentLeads: recentLeads.data ?? [],
    activeProjects: activeProjects.count ?? 0,
    pipelineByStage: Object.fromEntries(byStage),
    renewals: renewals.data ?? [],
    toCollectCents: toCollect,
    overdueCents: overdue,
    myTasks: myTasks.data ?? [],
    unassigned: unassigned.slice(0, 6).map((t) => ({ id: t.id, title: t.title, number: t.number, status: t.status, priority: t.priority, due_date: t.due_date, project: t.project })),
    unassignedCount: unassigned.length,
  };
}

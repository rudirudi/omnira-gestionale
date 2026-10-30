import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [clients, openLeads, wonMonth, dueActivities, recentLeads] = await Promise.all([
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
  ]);

  const pipeline = (openLeads.data ?? []).reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0);
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
  };
}

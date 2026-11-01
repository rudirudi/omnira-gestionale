import "server-only";
import { createClient } from "@/lib/supabase/server";
import { withBalance } from "./balance";

const SELECT =
  "*, client:clients(id, name), project:projects(id, code, name), renewal:renewals(id, name, type), payments(id, amount_cents, paid_on, method, note, created_at)";

export async function listReceivables(filter: { clientId?: string; projectId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("receivables").select(SELECT).is("deleted_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(2000);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data.map((r) => withBalance({ ...r, payments: [...r.payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)) }));
}
export type ReceivableItem = Awaited<ReturnType<typeof listReceivables>>[number];

export async function listProjectOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, code, name, client_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

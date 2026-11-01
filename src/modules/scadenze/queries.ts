import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listRenewals(filter: { clientId?: string; includeInactive?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("renewals")
    .select("*, client:clients(id, name), project:projects(id, code, name)")
    .is("deleted_at", null)
    .order("next_due_date");
  if (!filter.includeInactive) q = q.eq("active", true);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  const { data, error } = await q.limit(2000);
  if (error) throw new Error(error.message);
  return data;
}
export type RenewalItem = Awaited<ReturnType<typeof listRenewals>>[number];

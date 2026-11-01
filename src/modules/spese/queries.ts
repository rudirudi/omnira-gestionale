import "server-only";
import { createClient } from "@/lib/supabase/server";

const EXPENSE_SELECT =
  "*, person:profiles!expenses_paid_by_fkey(id, full_name), project:projects(id, code, name), client:clients(id, name), subscription:expense_subscriptions(id, name, frequency)";

export async function listExpenses(filter: { projectId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .is("deleted_at", null)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
export type ExpenseItem = Awaited<ReturnType<typeof listExpenses>>[number];

export async function listSubscriptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_subscriptions")
    .select("*, person:profiles!expense_subscriptions_paid_by_fkey(id, full_name), expenses(amount_cents)")
    .is("deleted_at", null)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return data.map(({ expenses, ...s }) => ({
    ...s,
    totalCents: expenses.reduce((t, e) => t + e.amount_cents, 0),
  }));
}
export type SubscriptionItem = Awaited<ReturnType<typeof listSubscriptions>>[number];

/** Pagamenti ricevuti (solo data e importo) per calcolare il saldo del periodo */
export async function listIncomeDays() {
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("paid_on, amount_cents").limit(10000);
  return data ?? [];
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listLeads() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, owner:profiles!leads_owner_id_fkey(id, full_name), client:clients(id, name)")
    .is("deleted_at", null)
    .order("position")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data;
}
export type LeadWithRefs = Awaited<ReturnType<typeof listLeads>>[number];

export async function getLeadActivities(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*, author:profiles!activities_created_by_fkey(full_name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

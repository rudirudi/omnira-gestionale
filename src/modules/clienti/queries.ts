import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/database.types";

export async function listClients({ q, status }: { q?: string; status?: ClientStatus }) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, vat_number, city, province, sector, status, email, phone, updated_at, owner:profiles!clients_owner_id_fkey(full_name)")
    .is("deleted_at", null)
    .order("name");
  if (status) query = query.eq("status", status);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`name.ilike.${like},vat_number.ilike.${like},city.ilike.${like},email.ilike.${like}`);
  }
  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);
  return data;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*, owner:profiles!clients_owner_id_fkey(id, full_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function getClientRelated(id: string) {
  const supabase = await createClient();
  const [contacts, activities, leads] = await Promise.all([
    supabase.from("contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }).order("first_name"),
    supabase
      .from("activities")
      .select("*, author:profiles!activities_created_by_fkey(full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("leads")
      .select("id, title, stage, estimated_value_cents, updated_at")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);
  return { contacts: contacts.data ?? [], activities: activities.data ?? [], leads: leads.data ?? [] };
}

export async function listTeam() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name");
  return data ?? [];
}

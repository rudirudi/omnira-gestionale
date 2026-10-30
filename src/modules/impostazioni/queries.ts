import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getSettingsData() {
  const supabase = await createClient();
  const [company, members, sites] = await Promise.all([
    supabase.from("company_settings").select("*").eq("id", 1).single(),
    supabase.from("profiles").select("*").order("active", { ascending: false }).order("full_name"),
    supabase.from("sites").select("*").order("name"),
  ]);
  return { company: company.data, members: members.data ?? [], sites: sites.data ?? [] };
}

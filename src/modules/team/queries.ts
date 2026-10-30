import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TeamMember = { id: string; full_name: string };

export async function listActiveTeam(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name");
  return data ?? [];
}

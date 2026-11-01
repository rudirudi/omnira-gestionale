import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listServices({ onlyActive = false } = {}) {
  const supabase = await createClient();
  let q = supabase.from("services").select("*").is("deleted_at", null).order("category").order("position").order("name");
  if (onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
export type ServiceItem = Awaited<ReturnType<typeof listServices>>[number];

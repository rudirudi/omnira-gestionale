"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function listNotificationsAction() {
  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_id_fkey(full_name)")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}
export type NotificationItem = Awaited<ReturnType<typeof listNotificationsAction>>[number];

export async function markNotificationsReadAction(ids?: string[]) {
  const me = await getCurrentUser();
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
}

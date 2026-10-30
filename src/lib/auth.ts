import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, ProfileRow } from "@/lib/database.types";

export type CurrentUser = Pick<ProfileRow, "id" | "full_name" | "email" | "role" | "site_id" | "job_title">;

/** Utente corrente (una lettura per richiesta). Reindirizza al login se manca o è disattivato. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, site_id, job_title, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?errore=disattivato");
  }
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    site_id: profile.site_id,
    job_title: profile.job_title,
  };
});

/** Per le Server Action: verifica sessione e ruolo vicino ai dati. */
export async function requireRole(roles: AppRole[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) {
    throw new Error("Non hai i permessi per questa operazione.");
  }
  return user;
}

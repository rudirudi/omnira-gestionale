"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = { kind: "cliente" | "lead"; id: string; title: string; subtitle?: string | null; href: string };

/** Ricerca globale per la palette comandi (Ctrl/⌘ K). RLS limita i risultati. */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const like = `%${q}%`;

  const [clients, leads] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, city, vat_number")
      .is("deleted_at", null)
      .or(`name.ilike.${like},vat_number.ilike.${like},email.ilike.${like}`)
      .limit(6),
    supabase
      .from("leads")
      .select("id, title, company_name")
      .is("deleted_at", null)
      .or(`title.ilike.${like},company_name.ilike.${like},contact_name.ilike.${like}`)
      .limit(6),
  ]);

  return [
    ...(clients.data ?? []).map((c) => ({
      kind: "cliente" as const,
      id: c.id,
      title: c.name,
      subtitle: c.city ?? c.vat_number,
      href: `/clienti/${c.id}`,
    })),
    ...(leads.data ?? []).map((l) => ({
      kind: "lead" as const,
      id: l.id,
      title: l.title,
      subtitle: l.company_name,
      href: `/lead?aperto=${l.id}`,
    })),
  ];
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listQuotes(filter: { clientId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("quotes")
    .select("id, number, title, status, issue_date, valid_until, vat_rate, discount_cents, client:clients(id, name), lead:leads(id, title, company_name), quote_items(quantity, unit_price_cents, frequency)")
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(1000);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
export type QuoteListItem = Awaited<ReturnType<typeof listQuotes>>[number];

export async function getQuote(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "*, client:clients(id, name, legal_name, vat_number, tax_code, address, city, province, zip, email, pec), lead:leads(id, title, company_name, contact_name, email, stage, client_id), project:projects(id, code, name), owner:profiles!quotes_owner_id_fkey(id, full_name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("position");
  return { ...data, items: items ?? [] };
}
export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

export async function getCompany() {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

/** Destinatari possibili: clienti e lead ancora aperti */
export async function listRecipients() {
  const supabase = await createClient();
  const [clients, leads] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null).neq("status", "inattivo").order("name"),
    supabase.from("leads").select("id, title, company_name, client_id").is("deleted_at", null).not("stage", "in", "(vinto,perso)").order("created_at", { ascending: false }),
  ]);
  return { clients: clients.data ?? [], leads: leads.data ?? [] };
}

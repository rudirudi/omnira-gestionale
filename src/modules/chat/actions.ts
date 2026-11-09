"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type ActionResult, fromDbError } from "@/lib/action-result";
import type { ChatOverviewRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY = 4000;
const PAGE = 80;

export type ChatMessage = {
  id: string;
  conversation_id: string;
  author_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
export type ChatReadState = { user_id: string; last_read_at: string };
export type ChatThread = { messages: ChatMessage[]; reads: ChatReadState[]; hasMore: boolean };

const COLS = "id, conversation_id, author_id, body, edited_at, deleted_at, created_at";

export async function chatOverviewAction(): Promise<ChatOverviewRow[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_overview");
  return data ?? [];
}

export async function chatUnreadAction(): Promise<number> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_unread_total");
  return data ?? 0;
}

/**
 * Messaggi di una conversazione, dal più vecchio al più recente.
 * before: pagina precedente; since: tutto da quella data in poi (per arrivare a un risultato di ricerca).
 */
export async function chatMessagesAction(conversationId: string, opts: { before?: string; since?: string } = {}): Promise<ChatThread> {
  await getCurrentUser();
  const conv = z.guid().parse(conversationId);
  const supabase = await createClient();
  let q = supabase.from("chat_messages").select(COLS).eq("conversation_id", conv).order("created_at", { ascending: false });
  if (opts.before) q = q.lt("created_at", z.iso.datetime({ offset: true }).parse(opts.before));
  if (opts.since) q = q.gte("created_at", z.iso.datetime({ offset: true }).parse(opts.since)).limit(1000);
  else q = q.limit(PAGE + 1);
  const [{ data }, { data: reads }] = await Promise.all([
    q,
    supabase.from("chat_members").select("user_id, last_read_at").eq("conversation_id", conv),
  ]);
  const rows = (data ?? []) as ChatMessage[];
  const hasMore = !opts.since && rows.length > PAGE;
  return { messages: rows.slice(0, opts.since ? rows.length : PAGE).reverse(), reads: reads ?? [], hasMore };
}

export async function chatSendAction(conversationId: string, body: string): Promise<ActionResult<ChatMessage>> {
  const me = await getCurrentUser();
  const text = body.trim();
  if (!text) return { ok: false, error: "Il messaggio è vuoto" };
  if (text.length > MAX_BODY) return { ok: false, error: `Messaggio troppo lungo (max ${MAX_BODY} caratteri)` };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: z.guid().parse(conversationId), body: text, author_id: me.id })
    .select(COLS)
    .single();
  if (error) return fromDbError(error);
  return { ok: true, data: data as ChatMessage };
}

export async function chatEditAction(id: string, body: string): Promise<ActionResult> {
  await getCurrentUser();
  const text = body.trim();
  if (!text) return { ok: false, error: "Il messaggio è vuoto" };
  if (text.length > MAX_BODY) return { ok: false, error: `Messaggio troppo lungo (max ${MAX_BODY} caratteri)` };
  const supabase = await createClient();
  const { data, error } = await supabase.from("chat_messages").update({ body: text }).eq("id", z.guid().parse(id)).select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return { ok: false, error: "Puoi modificare solo i tuoi messaggi." };
  return { ok: true };
}

export async function chatDeleteAction(id: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", z.guid().parse(id))
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return { ok: false, error: "Puoi eliminare solo i tuoi messaggi." };
  return { ok: true };
}

export async function chatMarkReadAction(conversationId: string): Promise<void> {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.rpc("chat_mark_read", { conv: z.guid().parse(conversationId) });
}

export async function chatOpenDirectAction(otherId: string): Promise<ActionResult<string>> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_open_direct", { other: z.guid().parse(otherId) });
  if (error || !data) return { ok: false, error: error?.message === "Utente non attivo" ? "Questo utente non è attivo." : "Non riesco ad aprire la chat. Riprova." };
  return { ok: true, data };
}

export type ChatSearchHit = ChatMessage;

export async function chatSearchAction(query: string): Promise<ChatSearchHit[]> {
  await getCurrentUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select(COLS)
    .ilike("body", like)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as ChatMessage[];
}

/** Colleghi attivi (nomi nel riquadro chat in basso) */
export async function chatTeamAction(): Promise<{ id: string; full_name: string }[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name");
  return data ?? [];
}

/** Segnale "sono online" + chi è online adesso (ultimo segnale per utente) */
export async function chatPresenceAction(): Promise<Record<string, string>> {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.rpc("chat_heartbeat");
  const { data } = await supabase.from("user_presence").select("user_id, last_seen_at");
  return Object.fromEntries((data ?? []).map((r) => [r.user_id, r.last_seen_at]));
}

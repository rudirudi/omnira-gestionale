import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Webhook del bot Telegram. Gestisce solo /start <codice> (collega la chat al profilo)
 * e /stop (scollega). La verifica del segreto avviene nel database (telegram_link),
 * quindi qui non serve nessuna chiave.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const update = (await req.json().catch(() => null)) as {
    message?: { text?: string; chat?: { id?: number }; from?: { username?: string } };
  } | null;
  const msg = update?.message;
  const chat = msg?.chat?.id;
  const text = msg?.text?.trim() ?? "";
  if (!chat || !text.startsWith("/")) return Response.json({ ok: true });

  const [cmd, arg] = text.split(/\s+/, 2);
  const code = cmd === "/stop" ? "stop" : cmd?.startsWith("/start") ? (arg ?? "") : null;
  if (code === null) return Response.json({ ok: true });

  // Nessuna sessione utente: la richiesta arriva da Telegram
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("telegram_link", { p_secret: secret, p_code: code, p_chat: chat, p_username: msg?.from?.username ?? null });
  if (error) console.error("[telegram] errore collegamento:", error.message);
  else if (data !== "collegato" && data !== "scollegato") console.warn("[telegram]", data);
  return Response.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const DEFAULT_NEXT: Record<string, string> = {
  recovery: "/nuova-password",
  invite: "/nuova-password",
  signup: "/",
  email: "/",
  magiclink: "/",
  email_change: "/impostazioni?scheda=profilo",
};

/**
 * Conferma dei link email (registrazione, invito, reset password, magic link)
 * tramite token_hash: funziona da qualsiasi browser o dispositivo.
 * Richiede i template email di Supabase indicati nel README.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), DEFAULT_NEXT[type ?? ""] ?? "/");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    if (/expired/i.test(error.message)) return NextResponse.redirect(`${origin}/login?errore=scaduto`);
  }
  return NextResponse.redirect(`${origin}/login?errore=link`);
}

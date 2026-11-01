import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Ritorno da Google OAuth e dai link email in modalità PKCE (?code=...).
 * Il codice funziona solo nello stesso browser che ha avviato l'operazione:
 * per i link email usiamo di preferenza /auth/confirm (token_hash), valido ovunque.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  const reason = searchParams.get("error_code") === "otp_expired" ? "scaduto" : "link";
  return NextResponse.redirect(`${origin}/login?errore=${reason}`);
}

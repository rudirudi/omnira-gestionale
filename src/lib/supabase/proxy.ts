import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

const PUBLIC_PATHS = ["/login", "/registrati", "/auth", "/configurazione", "/api/telegram"];

/** Rinnova la sessione a ogni richiesta e manda al login chi non è autenticato. */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isSupabaseConfigured) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/configurazione", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Non inserire codice tra createServerClient e getClaims: serve a rinnovare il token.
  // getClaims verifica il token localmente (chiavi asimmetriche), senza andata e ritorno al server Auth.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  if (user && (pathname === "/login" || pathname === "/registrati") && !request.nextUrl.searchParams.has("errore")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

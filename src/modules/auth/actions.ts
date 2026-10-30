"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

const credentials = z.object({
  email: z.email("Inserisci un'email valida"),
  password: z.string().min(1, "Inserisci la password"),
  next: z.string().optional(),
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: "Email o password non corretti." };
  redirect(safeNext(parsed.data.next));
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const next = safeNext(String(formData.get("next") ?? "/"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?errore=google");
  redirect(data.url);
}

export async function sendPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Inserisci un'email valida" };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/impostazioni?scheda=profilo`,
  });
  // Stessa risposta in ogni caso: non riveliamo quali email esistono.
  return { ok: true, message: "Se l'email è registrata, riceverai un link per reimpostare la password." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

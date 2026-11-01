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

import { safeNext } from "@/lib/safe-next";

export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: "Email o password non corretti." };

  // Account creato ma non ancora attivato da un amministratore
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { ok: false, error: "Il tuo account non è ancora attivo: un amministratore deve attivarlo da Impostazioni → Team." };
  }
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
    redirectTo: `${origin}/auth/callback?next=/nuova-password`,
  });
  // Stessa risposta in ogni caso: non riveliamo quali email esistono.
  return { ok: true, message: "Se l'email è registrata, riceverai un link per reimpostare la password." };
}

const signUpSchema = z
  .object({
    full_name: z.string().trim().min(3, "Inserisci nome e cognome"),
    email: z.email("Inserisci un'email valida"),
    password: z.string().min(10, "La password deve avere almeno 10 caratteri"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Le password non coincidono", path: ["confirm"] });

export async function signUp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${origin}/auth/callback?next=/`,
    },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { ok: false, error: "Esiste già un account con questa email: accedi o reimposta la password." };
    if (/signups not allowed|disabled/i.test(error.message)) return { ok: false, error: "Le registrazioni sono chiuse. Chiedi un invito a un amministratore." };
    if (/password/i.test(error.message)) return { ok: false, error: "Password troppo debole: usa almeno 10 caratteri con lettere e numeri." };
    return { ok: false, error: "Registrazione non riuscita. Riprova tra poco." };
  }
  // Se la conferma email è disattivata Supabase crea subito la sessione: usciamo, l'account va attivato.
  if (data.session) await supabase.auth.signOut();
  return {
    ok: true,
    message: "Account creato. Controlla l'email per confermarlo; poi un amministratore lo attiverà e potrai accedere.",
  };
}

export async function setNewPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z
    .object({ password: z.string().min(10, "Almeno 10 caratteri"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Le password non coincidono", path: ["confirm"] });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Password non aggiornata: il link potrebbe essere scaduto. Richiedine uno nuovo." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

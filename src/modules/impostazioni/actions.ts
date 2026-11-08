"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { type ActionResult, fromDbError, fromZodError, optionalText } from "@/lib/action-result";

const companySchema = z.object({
  legal_name: z.string().trim().min(1, "Obbligatorio"),
  vat_number: optionalText,
  tax_code: optionalText,
  sdi_code: optionalText,
  pec: optionalText,
  email: optionalText,
  phone: optionalText,
  address: optionalText,
  iban: optionalText,
  invoice_prefix: z.string().trim().min(1).max(10),
  default_vat_rate: z.coerce.number().min(0).max(100),
});

export async function updateCompanyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "amministrazione"]);
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update(parsed.data).eq("id", 1);
  if (error) return fromDbError(error);
  revalidatePath("/impostazioni");
  return { ok: true, message: "Dati aziendali salvati" };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Inserisci nome e cognome"),
  job_title: optionalText,
  site_id: optionalText,
});

export async function updateMyProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", me.id);
  if (error) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profilo aggiornato" };
}

export async function changePasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z
    .object({
      password: z.string().min(10, "Almeno 10 caratteri"),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: "Le password non coincidono", path: ["confirm"] });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Password non aggiornata: " + error.message };
  return { ok: true, message: "Password aggiornata" };
}

const memberSchema = z.object({
  id: z.guid(),
  role: z.enum(["admin", "project_manager", "team", "amministrazione", "commerciale"]),
  site_id: z.string().optional().transform((v) => v || null),
  active: z.boolean(),
});

export async function updateMemberAction(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  const me = await requireRole(["admin"]);
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi" };
  if (parsed.data.id === me.id && (parsed.data.role !== "admin" || !parsed.data.active)) {
    return { ok: false, error: "Non puoi togliere a te stesso il ruolo di amministratore." };
  }
  const supabase = await createClient();
  const { id, ...rest } = parsed.data;
  const { error } = await supabase.from("profiles").update(rest).eq("id", id);
  if (error) return fromDbError(error);
  revalidatePath("/impostazioni");
  return { ok: true, message: "Membro aggiornato" };
}

const prefsSchema = z.object({
  email_on: z.literal("on").optional(),
  email_mode: z.enum(["registrazione", "altra"]).default("registrazione"),
  notification_email: z.string().trim().optional(),
  telegram_on: z.literal("on").optional(),
  whatsapp_on: z.literal("on").optional(),
  whatsapp_number: z.string().trim().optional(),
});

/** Preferenze personali di notifica: canali e indirizzi */
export async function saveNotificationPrefsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = prefsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const other = d.email_mode === "altra" ? (d.notification_email ?? "") : "";
  if (d.email_mode === "altra" && !z.email().safeParse(other).success) {
    return { ok: false, error: "Scrivi un'email valida", fieldErrors: { notification_email: ["Email non valida"] } };
  }
  const phone = (d.whatsapp_number ?? "").replace(/\s+/g, " ");
  if (d.whatsapp_on && !/^\+?[0-9 ]{8,20}$/.test(phone)) {
    return { ok: false, error: "Scrivi il numero WhatsApp con il prefisso, es. +39 333 1234567", fieldErrors: { whatsapp_number: ["Numero non valido"] } };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      email_notifications: !!d.email_on,
      notification_email: other || null,
      notify_telegram: !!d.telegram_on,
      notify_whatsapp: !!d.whatsapp_on,
      whatsapp_number: phone || null,
    })
    .eq("id", me.id);
  if (error) return fromDbError(error);
  revalidatePath("/impostazioni");
  return { ok: true, message: "Preferenze di notifica salvate" };
}

/** Prepara il link per collegare Telegram: il bot riceve /start <codice> */
export async function telegramConnectAction(): Promise<ActionResult<{ url: string }>> {
  const me = await getCurrentUser();
  const supabase = await createClient();
  const { data: ch } = await supabase.rpc("notification_channels");
  const bot = ch?.[0]?.telegram_bot;
  if (!bot) return { ok: false, error: "Telegram non è ancora disponibile: riprova più tardi." };
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await supabase.from("profiles").update({ telegram_link_code: code }).eq("id", me.id);
  if (error) return fromDbError(error) as ActionResult<{ url: string }>;
  return { ok: true, data: { url: `https://t.me/${bot}?start=${code}` } };
}

export async function telegramDisconnectAction(): Promise<ActionResult> {
  const me = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ telegram_chat_id: null, telegram_username: null, notify_telegram: false }).eq("id", me.id);
  if (error) return fromDbError(error);
  revalidatePath("/impostazioni");
  return { ok: true, message: "Telegram scollegato" };
}

export async function sendTestEmailAction(): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_test_email");
  if (error) return fromDbError(error);
  revalidatePath("/impostazioni");
  if (!data?.startsWith("inviata")) return { ok: false, error: "Le email non sono ancora attive: la prova non è partita." };
  return { ok: true, message: `Email di prova inviata a ${data.slice("inviata:".length)}: controlla anche lo spam` };
}

export async function sendTestTelegramAction(): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_test_telegram");
  if (error) return fromDbError(error);
  if (data === "non_collegato") return { ok: false, error: "Prima collega Telegram." };
  if (data !== "inviata") return { ok: false, error: "Telegram non è ancora attivo." };
  return { ok: true, message: "Messaggio di prova inviato su Telegram" };
}

/** Solo admin: ricollega il bot Telegram al gestionale e ne legge il nome */
export async function telegramSetupAction(): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (me.role !== "admin") return { ok: false, error: "Solo un amministratore." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("telegram_setup");
  if (error) return fromDbError(error);
  if (data === "senza_token") return { ok: false, error: "Il bot Telegram non è ancora configurato." };
  revalidatePath("/impostazioni");
  return { ok: true, message: "Bot Telegram verificato: aggiorna la pagina tra qualche secondo" };
}

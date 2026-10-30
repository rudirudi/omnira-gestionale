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

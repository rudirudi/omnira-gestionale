import { z } from "zod";
import { optionalText } from "@/lib/action-result";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  legal_name: optionalText,
  vat_number: optionalText.refine((v) => !v || /^[0-9A-Z]{8,15}$/.test(v.replace(/^IT/i, "").toUpperCase()), {
    message: "P.IVA non valida",
  }),
  tax_code: optionalText,
  sdi_code: optionalText.refine((v) => !v || /^[0-9A-Z]{6,7}$/i.test(v), { message: "Il codice SDI ha 6 o 7 caratteri" }),
  pec: optionalText.refine((v) => !v || z.email().safeParse(v).success, { message: "PEC non valida" }),
  email: optionalText.refine((v) => !v || z.email().safeParse(v).success, { message: "Email non valida" }),
  phone: optionalText,
  website: optionalText,
  address: optionalText,
  city: optionalText,
  province: optionalText,
  zip: optionalText,
  sector: optionalText,
  status: z.enum(["prospect", "attivo", "inattivo"]).default("attivo"),
  owner_id: optionalText,
  notes: optionalText,
});
export type ClientInput = z.infer<typeof clientSchema>;

export const contactSchema = z.object({
  client_id: z.uuid(),
  first_name: z.string().trim().min(1, "Il nome è obbligatorio"),
  last_name: optionalText,
  job_title: optionalText,
  email: optionalText.refine((v) => !v || z.email().safeParse(v).success, { message: "Email non valida" }),
  phone: optionalText,
  is_primary: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const activitySchema = z
  .object({
    client_id: z.uuid().optional(),
    lead_id: z.uuid().optional(),
    type: z.enum(["nota", "chiamata", "email", "riunione", "promemoria"]),
    subject: z.string().trim().min(1, "Scrivi un oggetto").max(200),
    body: optionalText,
    due_at: optionalText,
  })
  .refine((v) => v.client_id || v.lead_id, { message: "Manca il riferimento" });

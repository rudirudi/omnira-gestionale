import { z } from "zod";
import { euroToCents, optionalText } from "@/lib/action-result";

export const STAGES = ["nuovo", "call", "analisi", "preventivo", "vinto", "perso"] as const;
export const SOURCES = ["sito", "form", "chatbot", "whatsapp", "referral", "social", "evento", "altro"] as const;

export const leadSchema = z.object({
  title: z.string().trim().min(1, "Dai un titolo al lead").max(200),
  company_name: optionalText,
  contact_name: optionalText,
  email: optionalText.refine((v) => !v || z.email().safeParse(v).success, { message: "Email non valida" }),
  phone: optionalText,
  source: z.enum(SOURCES).default("sito"),
  service_interest: optionalText,
  estimated_value: euroToCents,
  expected_close_date: optionalText,
  owner_id: optionalText,
  notes: optionalText,
});

export const moveSchema = z
  .object({
    id: z.uuid(),
    stage: z.enum(STAGES),
    position: z.number(),
    lost_reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.stage !== "perso" || (v.lost_reason && v.lost_reason.length > 0), {
    message: "Indica il motivo per cui il lead è perso",
  });

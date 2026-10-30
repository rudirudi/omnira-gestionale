import { z } from "zod";
import { euroToCents, optionalText } from "@/lib/action-result";

export const PROJECT_TYPES = ["sito", "ecommerce", "software", "app", "gestionale", "automazione_ai", "seo", "altro"] as const;
export const PROJECT_STATUSES = ["pianificato", "attivo", "in_pausa", "completato", "annullato"] as const;

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Dai un nome al progetto").max(200),
    client_id: optionalText,
    type: z.enum(PROJECT_TYPES).default("altro"),
    status: z.enum(PROJECT_STATUSES).default("pianificato"),
    billing_type: z.enum(["corpo", "ore", "canone"]).default("corpo"),
    budget: euroToCents,
    budget_hours: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          ctx.addIssue({ code: "custom", message: "Ore non valide" });
          return z.NEVER;
        }
        return n;
      }),
    start_date: optionalText,
    due_date: optionalText,
    manager_id: optionalText,
    description: optionalText,
    use_template: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    message: "La consegna non può precedere l'inizio",
    path: ["due_date"],
  });

export function projectRow(data: z.infer<typeof projectSchema>) {
  const { budget, use_template: _t, ...rest } = data;
  void _t;
  return { ...rest, budget_cents: budget };
}

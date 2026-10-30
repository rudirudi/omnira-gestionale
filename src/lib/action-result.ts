import { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const initialActionState: ActionResult = { ok: true };

export function fromZodError(error: z.ZodError): ActionResult {
  return {
    ok: false,
    error: "Controlla i campi evidenziati.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
  };
}

/** Errori Postgres → messaggi comprensibili */
export function fromDbError(error: { code?: string; message: string }): ActionResult {
  if (error.code === "23505") return { ok: false, error: "Esiste già un record con questi dati (es. stessa P.IVA)." };
  if (error.code === "42501") return { ok: false, error: "Non hai i permessi per questa operazione." };
  if (error.code === "23514") return { ok: false, error: "Alcuni dati non rispettano le regole (es. motivo obbligatorio)." };
  return { ok: false, error: "Operazione non riuscita. Riprova tra poco." };
}

/** Campo di testo opzionale: stringa vuota → null */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** "1.234,50" o "1234.5" → centesimi */
export const euroToCents = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = v.replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Importo non valido" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

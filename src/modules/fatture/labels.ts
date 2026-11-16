import type { InvoiceStatus } from "@/lib/database.types";
import type { Tone } from "@/lib/areas";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone; hint: string }> = {
  bozza: { label: "Bozza", tone: "neutral", hint: "Non ancora inviata" },
  in_invio: { label: "In invio", tone: "primary", hint: "Consegnata a Invoicetronic, in attesa di risposta" },
  inviata: { label: "Inviata allo SDI", tone: "primary", hint: "Lo SDI la sta controllando e consegnando" },
  consegnata: { label: "Consegnata", tone: "success", hint: "Emessa: il cliente l'ha ricevuta (o la trova nel suo cassetto fiscale)" },
  non_consegnata: { label: "Non consegnata", tone: "warning", hint: "Lo SDI non è riuscito a consegnarla" },
  scartata: { label: "Scartata", tone: "danger", hint: "Lo SDI l'ha rifiutata: correggi e reinvia entro 5 giorni" },
  errore: { label: "Errore di invio", tone: "danger", hint: "Non è partita: correggi e riprova" },
};

export const PURCHASE_STATUS: Record<"da_registrare" | "registrata" | "pagata" | "ignorata", { label: string; tone: Tone }> = {
  da_registrare: { label: "Da registrare", tone: "warning" },
  registrata: { label: "Registrata", tone: "primary" },
  pagata: { label: "Pagata", tone: "success" },
  ignorata: { label: "Ignorata", tone: "neutral" },
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  software: "Software",
  hosting: "Hosting",
  domini: "Domini",
  hardware: "Hardware",
  collaboratori: "Collaboratori",
  marketing: "Marketing",
  trasferte: "Trasferte",
  formazione: "Formazione",
  ufficio: "Ufficio",
  telefonia: "Telefonia",
  tasse: "Tasse",
  banca: "Banca",
  altro: "Altro",
};

export const invoiceNumber = (inv: { number: number | null; year: number | null; test?: boolean }, prefix = "") =>
  inv.number ? `${prefix ? `${prefix} ` : ""}${inv.number}/${inv.year}` : "Bozza";

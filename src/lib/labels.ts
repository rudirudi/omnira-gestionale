import type { ActivityType, ClientStatus, LeadSource, LeadStage } from "@/lib/database.types";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: Tone }> = {
  attivo: { label: "Attivo", tone: "success" },
  prospect: { label: "Prospect", tone: "primary" },
  inattivo: { label: "Inattivo", tone: "neutral" },
};

export const LEAD_STAGES: { value: LeadStage; label: string; tone: Tone }[] = [
  { value: "nuovo", label: "Nuovo", tone: "neutral" },
  { value: "call", label: "Call conoscitiva", tone: "primary" },
  { value: "analisi", label: "Analisi", tone: "primary" },
  { value: "preventivo", label: "Preventivo inviato", tone: "warning" },
  { value: "vinto", label: "Vinto", tone: "success" },
  { value: "perso", label: "Perso", tone: "danger" },
];
export const LEAD_STAGE = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, s])) as Record<
  LeadStage,
  (typeof LEAD_STAGES)[number]
>;

export const LEAD_SOURCE: Record<LeadSource, string> = {
  sito: "Sito web",
  form: "Form contatti",
  chatbot: "Chatbot",
  whatsapp: "WhatsApp",
  referral: "Passaparola",
  social: "Social",
  evento: "Evento",
  altro: "Altro",
};

export const ACTIVITY_TYPE: Record<ActivityType, string> = {
  nota: "Nota",
  chiamata: "Chiamata",
  email: "Email",
  riunione: "Riunione",
  promemoria: "Promemoria",
};

/** Servizi del listino Omnira, usati come "interesse" del lead (poi catalogo in M7). */
export const SERVICES = [
  "Sito web / landing page",
  "E-commerce",
  "Gestione SEO",
  "Software su misura",
  "App mobile",
  "Gestionale (Software Omnira)",
  "Automazione AI",
  "AI Chat",
  "AI Voice",
];

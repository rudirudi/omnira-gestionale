import type {
  ActivityType,
  BillingType,
  ClientStatus,
  LeadSource,
  LeadStage,
  ProjectStatus,
  ProjectType,
  TaskPriority,
  TaskStatus,
} from "@/lib/database.types";

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


export const PROJECT_TYPE: Record<ProjectType, string> = {
  sito: "Sito web",
  ecommerce: "E-commerce",
  software: "Software su misura",
  app: "App mobile",
  gestionale: "Gestionale",
  automazione_ai: "Automazione AI",
  seo: "SEO",
  altro: "Altro",
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  pianificato: { label: "Pianificato", tone: "neutral" },
  attivo: { label: "Attivo", tone: "primary" },
  in_pausa: { label: "In pausa", tone: "warning" },
  completato: { label: "Completato", tone: "success" },
  annullato: { label: "Annullato", tone: "danger" },
};

export const BILLING_TYPE: Record<BillingType, string> = {
  corpo: "A corpo",
  ore: "A ore",
  canone: "A canone",
};

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: "da_fare", label: "Da fare", tone: "neutral" },
  { value: "in_corso", label: "In corso", tone: "primary" },
  { value: "in_review", label: "In review", tone: "warning" },
  { value: "test", label: "Test", tone: "warning" },
  { value: "fatto", label: "Fatto", tone: "success" },
];
export const TASK_STATUS = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s])) as Record<
  TaskStatus,
  (typeof TASK_STATUSES)[number]
>;

export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: Tone; rank: number }> = {
  urgente: { label: "Urgente", tone: "danger", rank: 0 },
  alta: { label: "Alta", tone: "warning", rank: 1 },
  media: { label: "Media", tone: "neutral", rank: 2 },
  bassa: { label: "Bassa", tone: "neutral", rank: 3 },
};

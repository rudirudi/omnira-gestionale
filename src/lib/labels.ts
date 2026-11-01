import type {
  ActivityType,
  BillingType,
  ExpenseCategory,
  ExpensePaidWith,
  ClientStatus,
  LeadSource,
  LeadStage,
  ProjectStatus,
  ProjectType,
  TaskPriority,
  TaskStatus,
} from "@/lib/database.types";

import type { Tone } from "@/lib/areas";

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
  { value: "test", label: "Test", tone: "primary" },
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

export const PAYMENT_METHOD: Record<string, string> = {
  bonifico: "Bonifico",
  carta: "Carta",
  contanti: "Contanti",
  paypal: "PayPal",
  stripe: "Stripe",
  riba: "Ri.Ba.",
  altro: "Altro",
};

export const RENEWAL_TYPE: Record<string, string> = {
  dominio: "Dominio",
  hosting: "Hosting",
  server: "Server",
  ssl: "Certificato SSL",
  email: "Caselle email",
  licenza: "Licenza",
  saas: "Abbonamento SaaS",
  manutenzione: "Manutenzione",
  altro: "Altro",
};

export const RENEWAL_FREQUENCY: Record<string, { label: string; perYear: number }> = {
  mensile: { label: "Mensile", perYear: 12 },
  trimestrale: { label: "Trimestrale", perYear: 4 },
  semestrale: { label: "Semestrale", perYear: 2 },
  annuale: { label: "Annuale", perYear: 1 },
  biennale: { label: "Ogni 2 anni", perYear: 0.5 },
};

export type ReceivableState = "da_pagare" | "parziale" | "pagato" | "scaduto";
export const RECEIVABLE_STATE: Record<ReceivableState, { label: string; tone: Tone }> = {
  da_pagare: { label: "Da pagare", tone: "neutral" },
  parziale: { label: "Pagato in parte", tone: "warning" },
  pagato: { label: "Pagato", tone: "success" },
  scaduto: { label: "Scaduto", tone: "danger" },
};

/** Categorie di spesa: etichetta + colore del pallino (palette del brand) */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: "software", label: "Software e abbonamenti", color: "bg-primary" },
  { value: "hosting", label: "Hosting e server", color: "bg-work" },
  { value: "domini", label: "Domini", color: "bg-[oklch(0.7_0.12_250)]" },
  { value: "collaboratori", label: "Collaboratori", color: "bg-sales" },
  { value: "marketing", label: "Marketing e pubblicità", color: "bg-support" },
  { value: "hardware", label: "Hardware", color: "bg-[oklch(0.45_0.05_260)]" },
  { value: "trasferte", label: "Trasferte", color: "bg-[oklch(0.75_0.15_70)]" },
  { value: "formazione", label: "Formazione", color: "bg-success" },
  { value: "ufficio", label: "Ufficio", color: "bg-[oklch(0.6_0.08_200)]" },
  { value: "telefonia", label: "Telefonia e internet", color: "bg-[oklch(0.62_0.13_300)]" },
  { value: "tasse", label: "Tasse e contributi", color: "bg-destructive" },
  { value: "banca", label: "Banca e commissioni", color: "bg-[oklch(0.55_0.03_260)]" },
  { value: "altro", label: "Altro", color: "bg-muted-foreground/50" },
];
export const EXPENSE_CATEGORY = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c])) as Record<
  ExpenseCategory,
  (typeof EXPENSE_CATEGORIES)[number]
>;

export const EXPENSE_PAID_WITH: Record<ExpensePaidWith, string> = {
  azienda: "Conto/carta aziendale",
  personale: "Di tasca propria (da rimborsare)",
};

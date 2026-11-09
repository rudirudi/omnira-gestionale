import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckSquare,
  Clock,
  FileSignature,
  HandCoins,
  LayoutDashboard,
  LifeBuoy,
  MessageCircleQuestion,
  MessagesSquare,
  Receipt,
  Settings,
  Tags,
  Target,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Ogni area del gestionale ha un colore fisso, usato in menu, intestazioni,
 * icone e grafici: l'occhio capisce dove si trova senza leggere.
 *  - operativo  = blu    (progetti, task, tempo)
 *  - commerciale = giallo (clienti, lead, preventivi)
 *  - economia   = verde  (incassi, spese, scadenze, fatture, report)
 *  - assistenza = rosso  (ticket)
 *  - sistema    = grigio-blu (dashboard, impostazioni)
 * Le classi sono scritte per esteso perché Tailwind le trovi nel codice.
 */
export type Area = "work" | "sales" | "money" | "support" | "system";

export const AREA: Record<
  Area,
  {
    label: string;
    tile: string; // riquadro icona
    text: string; // testo/icone colorati su sfondo chiaro
    soft: string; // sfondo tenue
    stripe: string; // barra/accento pieno
    border: string; // bordo colorato
    headerBg: string; // sfondo intestazione pagina
    navIcon: string; // icona su sidebar blu
    bandBorder: string; // bordo della card con fascia: stesso colore della fascia
    band: string; // fascia piena con testo bianco (card KPI): tonalità scure, leggibili anche in tema scuro
  }
> = {
  work: {
    label: "Operativo",
    tile: "bg-work text-white",
    text: "text-work-ink",
    soft: "bg-work/8",
    stripe: "bg-work",
    border: "border-work",
    headerBg: "bg-gradient-to-b from-work/[0.07] to-transparent",
    navIcon: "text-[oklch(0.8_0.1_250)]",
    band: "bg-gradient-to-r from-[oklch(0.42_0.15_262)] to-[oklch(0.52_0.17_255)]",
    bandBorder: "border-[oklch(0.47_0.16_258)]",
  },
  sales: {
    label: "Commerciale",
    tile: "bg-sales text-on-warning",
    text: "text-sales-ink",
    soft: "bg-sales/15",
    stripe: "bg-sales",
    border: "border-sales",
    headerBg: "bg-gradient-to-b from-sales/[0.14] to-transparent",
    navIcon: "text-sales",
    band: "bg-gradient-to-r from-[oklch(0.58_0.14_62)] to-[oklch(0.66_0.15_75)]",
    bandBorder: "border-[oklch(0.62_0.145_68)]",
  },
  money: {
    label: "Economia",
    tile: "bg-money text-white",
    text: "text-money-ink",
    soft: "bg-money/10",
    stripe: "bg-money",
    border: "border-money",
    headerBg: "bg-gradient-to-b from-money/[0.09] to-transparent",
    navIcon: "text-[oklch(0.78_0.15_150)]",
    band: "bg-gradient-to-r from-[oklch(0.47_0.13_150)] to-[oklch(0.57_0.15_150)]",
    bandBorder: "border-[oklch(0.52_0.14_150)]",
  },
  support: {
    label: "Assistenza",
    tile: "bg-support text-white",
    text: "text-support-ink",
    soft: "bg-support/10",
    stripe: "bg-support",
    border: "border-support",
    headerBg: "bg-gradient-to-b from-support/[0.08] to-transparent",
    navIcon: "text-[oklch(0.75_0.16_25)]",
    band: "bg-gradient-to-r from-[oklch(0.5_0.19_27)] to-[oklch(0.58_0.21_27)]",
    bandBorder: "border-[oklch(0.54_0.2_27)]",
  },
  system: {
    label: "Sistema",
    tile: "bg-primary text-primary-foreground",
    text: "text-system-ink",
    soft: "bg-muted",
    stripe: "bg-primary",
    border: "border-primary",
    headerBg: "bg-gradient-to-b from-primary/[0.06] to-transparent",
    navIcon: "text-sidebar-foreground",
    band: "bg-gradient-to-r from-[oklch(0.35_0.12_262)] to-[oklch(0.45_0.15_262)]",
    bandBorder: "border-[oklch(0.4_0.13_262)]",
  },
};

export type Module = { href: string; label: string; icon: LucideIcon; area: Area; module: string; phase?: number };

export const MODULES = {
  dashboard: { href: "/", label: "Dashboard", icon: LayoutDashboard, area: "system", module: "M1" },
  chat: { href: "/chat", label: "Chat", icon: MessagesSquare, area: "system", module: "M13" },
  progetti: { href: "/progetti", label: "Progetti", icon: Briefcase, area: "work", module: "M3" },
  task: { href: "/task", label: "Task", icon: CheckSquare, area: "work", module: "M4" },
  discussioni: { href: "/discussioni", label: "Punti aperti", icon: MessageCircleQuestion, area: "work", module: "M14" },
  tempo: { href: "/tempo", label: "Tempo", icon: Clock, area: "work", module: "M6", phase: 2 },
  clienti: { href: "/clienti", label: "Clienti", icon: Users, area: "sales", module: "M2" },
  lead: { href: "/lead", label: "Lead", icon: Target, area: "sales", module: "M2" },
  preventivi: { href: "/preventivi", label: "Preventivi", icon: FileSignature, area: "sales", module: "M7" },
  listino: { href: "/listino", label: "Listino", icon: Tags, area: "sales", module: "M7" },
  incassi: { href: "/incassi", label: "Incassi", icon: Wallet, area: "money", module: "M8" },
  spese: { href: "/spese", label: "Spese", icon: HandCoins, area: "money", module: "M9" },
  scadenze: { href: "/scadenze", label: "Scadenze", icon: CalendarClock, area: "money", module: "M9" },
  fatture: { href: "/fatture", label: "Fatture", icon: Receipt, area: "money", module: "M8", phase: 2 },
  report: { href: "/report", label: "Report", icon: BarChart3, area: "money", module: "M12", phase: 4 },
  ticket: { href: "/ticket", label: "Ticket", icon: LifeBuoy, area: "support", module: "M10", phase: 3 },
  impostazioni: { href: "/impostazioni", label: "Impostazioni", icon: Settings, area: "system", module: "M0" },
} satisfies Record<string, Module>;

/** Toni di stato condivisi da badge, colonne kanban e bordi delle card. */
export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
export const TONE: Record<Tone, { dot: string; columnTop: string; columnBg: string; cardBorder: string }> = {
  neutral: { dot: "bg-muted-foreground/60", columnTop: "border-t-muted-foreground/40", columnBg: "bg-muted/60", cardBorder: "border-l-muted-foreground/30" },
  primary: { dot: "bg-primary", columnTop: "border-t-primary", columnBg: "bg-primary/[0.05]", cardBorder: "border-l-primary" },
  success: { dot: "bg-success", columnTop: "border-t-success", columnBg: "bg-success/[0.06]", cardBorder: "border-l-success" },
  warning: { dot: "bg-warning", columnTop: "border-t-warning", columnBg: "bg-warning/[0.09]", cardBorder: "border-l-warning" },
  danger: { dot: "bg-destructive", columnTop: "border-t-destructive", columnBg: "bg-destructive/[0.05]", cardBorder: "border-l-destructive" },
};

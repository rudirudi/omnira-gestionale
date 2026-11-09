import { type Area, type Module, MODULES } from "@/lib/areas";

export type NavItem = Module;
export type NavSection = { label: string | null; area: Area; items: NavItem[] };

// Il menu è diviso per area: ogni area ha il suo colore (vedi lib/areas.ts)
export const NAV: NavSection[] = [
  { label: null, area: "system", items: [MODULES.dashboard, MODULES.chat] },
  { label: "Operativo", area: "work", items: [MODULES.progetti, MODULES.task, MODULES.discussioni, MODULES.tempo] },
  { label: "Commerciale", area: "sales", items: [MODULES.clienti, MODULES.lead, MODULES.preventivi, MODULES.listino] },
  { label: "Economia", area: "money", items: [MODULES.incassi, MODULES.spese, MODULES.scadenze, MODULES.fatture, MODULES.report] },
  { label: "Assistenza", area: "support", items: [MODULES.ticket] },
  { label: "Sistema", area: "system", items: [MODULES.impostazioni] },
];

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items);

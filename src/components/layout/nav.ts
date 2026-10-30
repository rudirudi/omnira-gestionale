import {
  BarChart3,
  Briefcase,
  CheckSquare,
  Clock,
  FileSignature,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Repeat,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; phase?: number; module: string };
export type NavSection = { label: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Lavoro",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, module: "M1" },
      { href: "/clienti", label: "Clienti", icon: Users, module: "M2" },
      { href: "/lead", label: "Lead", icon: Target, module: "M2" },
      { href: "/progetti", label: "Progetti", icon: Briefcase, module: "M3", phase: 1 },
      { href: "/task", label: "Task", icon: CheckSquare, module: "M4", phase: 1 },
      { href: "/tempo", label: "Tempo", icon: Clock, module: "M6", phase: 2 },
    ],
  },
  {
    label: "Amministrazione",
    items: [
      { href: "/preventivi", label: "Preventivi", icon: FileSignature, module: "M7", phase: 2 },
      { href: "/fatture", label: "Fatture", icon: Receipt, module: "M8", phase: 2 },
      { href: "/canoni", label: "Canoni", icon: Repeat, module: "M9", phase: 2 },
    ],
  },
  {
    label: "Assistenza e analisi",
    items: [
      { href: "/ticket", label: "Ticket", icon: LifeBuoy, module: "M10", phase: 3 },
      { href: "/report", label: "Report", icon: BarChart3, module: "M12", phase: 4 },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/impostazioni", label: "Impostazioni", icon: Settings, module: "M0" }],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items);

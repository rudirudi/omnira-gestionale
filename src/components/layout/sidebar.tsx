"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREA } from "@/lib/areas";
import { cn } from "@/lib/utils";
import { ChatUnreadBadge } from "@/modules/chat/components/chat-unread-badge";
import { NAV } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate, hidden = [] }: { onNavigate?: () => void; hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3" aria-label="Navigazione principale">
      {NAV.map((section) => (
        <div key={section.label ?? "home"} className="flex flex-col gap-0.5">
          {section.label && (
            <p className="flex items-center gap-2 px-2 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
              <span className={cn("size-1.5 rounded-full", AREA[section.area].stripe)} aria-hidden />
              {section.label}
            </p>
          )}
          {section.items.filter((item) => !hidden.includes(item.href)).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const area = AREA[item.area];
            return (
              <Link
                key={item.href}
                href={item.href}
                // Precarica tutta la pagina (dati inclusi) appena il menu è visibile: il clic è istantaneo.
                // I moduli ancora in costruzione restano col precaricamento standard.
                prefetch={item.phase && item.phase > 1 ? null : true}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
                  active && "bg-sidebar-active text-sidebar-active-foreground shadow-sm hover:bg-sidebar-active hover:text-sidebar-active-foreground",
                )}
              >
                {active && <span className={cn("absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full", area.stripe)} aria-hidden />}
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
                    active ? area.tile : cn("bg-white/[0.06]", area.navIcon),
                  )}
                >
                  <Icon className="size-[15px]" strokeWidth={2} />
                </span>
                <span className="truncate">{item.label}</span>
                {item.href === "/chat" && <ChatUnreadBadge active={active} />}
                {item.phase && item.phase > 1 ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold tabular",
                      active ? "bg-muted text-muted-foreground" : "bg-white/10 text-sidebar-muted",
                    )}
                    title={`In arrivo nella Fase ${item.phase}`}
                  >
                    F{item.phase}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex h-14 items-center gap-2.5 px-5">
      <span className="relative flex size-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary">
        O
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-warning ring-2 ring-sidebar" aria-hidden />
      </span>
      <span className="flex flex-col leading-none text-sidebar-foreground">
        <span className="text-sm font-semibold tracking-tight">Omnira</span>
        <span className="mt-0.5 text-[11px] text-sidebar-muted">Gestionale</span>
      </span>
    </Link>
  );
}

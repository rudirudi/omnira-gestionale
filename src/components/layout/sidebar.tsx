"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Navigazione principale">
      {NAV.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-sidebar-muted uppercase">{section.label}</p>
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
                  active && "bg-sidebar-active text-sidebar-active-foreground shadow-sm hover:bg-sidebar-active hover:text-sidebar-active-foreground",
                )}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
                {item.phase && item.phase > 1 ? (
                  <span className={cn("ml-auto rounded px-1 text-[10px] font-medium tabular", active ? "text-sidebar-active-foreground/60" : "text-sidebar-muted/80")}>F{item.phase}</span>
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
      <span className="relative flex size-7 items-center justify-center rounded-md bg-white text-[13px] font-bold text-primary">
        O
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-warning ring-2 ring-sidebar" aria-hidden />
      </span>
      <span className="flex flex-col leading-none text-sidebar-foreground">
        <span className="text-[13px] font-semibold tracking-tight">Omnira</span>
        <span className="text-[11px] text-sidebar-muted">Gestionale</span>
      </span>
    </Link>
  );
}

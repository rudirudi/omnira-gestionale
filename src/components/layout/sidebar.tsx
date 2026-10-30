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
          <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{section.label}</p>
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
                  "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-card text-foreground shadow-xs ring-1 ring-border",
                )}
              >
                <Icon className={cn("size-[17px] shrink-0", active && "text-primary")} strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
                {item.phase && item.phase > 1 ? (
                  <span className="ml-auto rounded px-1 text-[10px] font-medium text-muted-foreground/70 tabular">F{item.phase}</span>
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
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
        O
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-tight">Omnira</span>
        <span className="text-[11px] text-muted-foreground">Gestionale</span>
      </span>
    </Link>
  );
}

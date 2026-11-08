"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Striscia colorata a tutta larghezza che si apre con un clic.
 * Chiusa mostra titolo + riepilogo; aperta mostra il contenuto.
 * Lo stato aperto/chiuso è ricordato su questo browser.
 */
export function ExpandableStrip({
  id,
  icon,
  title,
  summary,
  band,
  border,
  href,
  linkLabel,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  summary?: React.ReactNode;
  band: string;
  border: string;
  href?: string;
  linkLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const key = `omnira-strip-${id}`;
  // Scelta ricordata su questo browser; sul server (e al primo render) vale defaultOpen
  const stored = React.useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [override, setOverride] = React.useState<boolean | null>(null);
  const open = override ?? (stored === null ? defaultOpen : stored === "1");
  const toggle = () => {
    const next = !open;
    setOverride(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {}
  };
  const bodyId = `${key}-body`;

  return (
    <section className={cn("overflow-hidden rounded-xl border shadow-xs", border)}>
      <div className={cn("flex items-center gap-3 px-4 py-2.5 text-white", band)}>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={bodyId} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="shrink-0 opacity-90 [&_svg]:size-4.5">{icon}</span>
          <span className="shrink-0 text-[14px] font-semibold">{title}</span>
          {summary && <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[12.5px] text-white/90">{summary}</span>}
          <ChevronDown className={cn("ml-auto size-4.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {href && (
          <Link href={href} className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-white/90 hover:bg-white/15 hover:text-white sm:flex">
            {linkLabel} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      <div id={bodyId} hidden={!open} className="bg-card p-4">
        {children}
      </div>
    </section>
  );
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Pillola bianca semitrasparente per i riepiloghi nelle strisce */
export function StripPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TaskTab = { key: string; label: string; count: number; content: React.ReactNode; alert?: boolean };

/** Schede del riquadro Task: il contenuto è già pronto, il cambio è istantaneo */
export function TaskTabs({ tabs, initial }: { tabs: TaskTab[]; initial?: string }) {
  const [active, setActive] = React.useState(initial ?? tabs[0]?.key);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div
        role="tablist"
        aria-label="Task"
        className="flex gap-1 overflow-x-auto"
        onKeyDown={(e) => {
          const i = tabs.findIndex((t) => t.key === active);
          const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
          if (next < 0 || next >= tabs.length) return;
          setActive(tabs[next].key);
          refs.current[next]?.focus();
        }}
      >
        {tabs.map((t, i) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls={`panel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
                on ? "bg-primary text-primary-foreground shadow-sm" : "border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular",
                  on ? "bg-white/20" : t.alert ? "bg-destructive text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={t.key !== active} tabIndex={0} className="-mr-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {t.content}
        </div>
      ))}
    </div>
  );
}

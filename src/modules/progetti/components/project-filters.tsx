"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const STATI = [
  { value: "", label: "Aperti" },
  { value: "attivo", label: "Attivi" },
  { value: "pianificato", label: "Pianificati" },
  { value: "in_pausa", label: "In pausa" },
  { value: "completato", label: "Completati" },
  { value: "tutti", label: "Tutti" },
];

export function ProjectFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const stato = params.get("stato") ?? "";
  const mine = params.get("miei") === "1";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`/progetti?${next.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-md border bg-card p-0.5" role="group" aria-label="Filtra per stato">
        {STATI.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={stato === s.value}
            onClick={() => set("stato", s.value)}
            className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", stato === s.value && "bg-muted text-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={mine} onChange={(e) => set("miei", e.target.checked ? "1" : "")} className="size-4 accent-[var(--primary)]" />
        Solo i miei progetti
      </label>
    </div>
  );
}

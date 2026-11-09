"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS } from "@/lib/labels";

export function ClientsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const status = params.get("stato") ?? "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/clienti?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const chips = [{ value: "", label: "Tutti" }, ...Object.entries(CLIENT_STATUS).map(([value, s]) => ({ value, label: s.label }))];

  return (
    <div className={cn("flex flex-wrap items-center gap-3", pending && "opacity-70")}>
      <div className="relative w-full max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome, P.IVA, città…"
          className="h-8 pl-8 text-[13px]"
          aria-label="Cerca clienti"
        />
      </div>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Filtra per stato">
        {chips.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => update("stato", c.value)}
            aria-pressed={status === c.value}
            className={cn(
              "h-7 rounded px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              status === c.value && "bg-muted text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

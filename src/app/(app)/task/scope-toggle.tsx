"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function TaskScopeToggle({ all }: { all: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (v: boolean) => {
    const next = new URLSearchParams(params);
    if (v) next.set("tutti", "1");
    else next.delete("tutti");
    router.replace(`/task?${next.toString()}`, { scroll: false });
  };
  return (
    <div className="flex items-center gap-1 rounded-md border bg-card p-0.5" role="group" aria-label="Quali task">
      {[
        { v: false, l: "Miei" },
        { v: true, l: "Tutto il team" },
      ].map((o) => (
        <button
          key={o.l}
          type="button"
          aria-pressed={all === o.v}
          onClick={() => set(o.v)}
          className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", all === o.v && "bg-muted text-foreground")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

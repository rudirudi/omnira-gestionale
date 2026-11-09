"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function TaskScopeToggle({ all }: { all: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (v: boolean) => {
    const next = new URLSearchParams(params);
    if (v) next.delete("miei");
    else next.set("miei", "1");
    router.replace(`/task?${next.toString()}`, { scroll: false });
  };
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Quali task">
      {[
        { v: true, l: "Tutti" },
        { v: false, l: "Solo i miei" },
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

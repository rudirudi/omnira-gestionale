import { Hammer } from "lucide-react";
import { AREA, type Module } from "@/lib/areas";
import { cn } from "@/lib/utils";
import { PageBody, PageHeader } from "./page-header";

export function ComingSoon({ mod, features }: { mod: Module; features: string[] }) {
  const a = AREA[mod.area];
  return (
    <>
      <PageHeader title={mod.label} icon={mod.icon} area={mod.area} description={`Modulo ${mod.module} · in arrivo nella Fase ${mod.phase ?? 2}`} />
      <PageBody>
        <div className="mx-auto mt-4 max-w-xl overflow-hidden rounded-xl border bg-card">
          <div className={cn("h-1", a.stripe)} />
          <div className="p-6">
            <div className="flex items-center gap-3">
              <span className={cn("flex size-10 items-center justify-center rounded-xl", a.soft, a.text)}>
                <Hammer className="size-5" strokeWidth={1.9} />
              </span>
              <div>
                <p className="font-semibold">Questo modulo è in costruzione</p>
                <p className="text-[13px] text-muted-foreground">Cosa conterrà, secondo il progetto:</p>
              </div>
            </div>
            <ul className="mt-5 flex flex-col gap-2.5 text-[13px]">
              {features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.stripe)} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PageBody>
    </>
  );
}

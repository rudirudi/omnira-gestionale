import { Hammer } from "lucide-react";
import { PageBody, PageHeader } from "./page-header";

export function ComingSoon({
  title,
  module,
  phase,
  features,
}: {
  title: string;
  module: string;
  phase: number;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={`Modulo ${module} · in arrivo nella Fase ${phase}`} />
      <PageBody>
        <div className="mx-auto mt-6 max-w-xl rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10">
              <Hammer className="size-[18px] text-primary" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-medium">Questo modulo è in costruzione</p>
              <p className="text-[13px] text-muted-foreground">Cosa conterrà, secondo il progetto:</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-[13px]">
            {features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </PageBody>
    </>
  );
}

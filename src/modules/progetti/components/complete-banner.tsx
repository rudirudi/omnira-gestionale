"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProjectStatusAction } from "../actions";

/** Tutti i task chiusi ma il progetto è ancora aperto: proponi di completarlo */
export function CompleteBanner({ projectId, total, canManage }: { projectId: string; total: number; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-success/40 bg-success/8 px-4 py-3">
      <CheckCircle2 className="size-5 shrink-0 text-success" />
      <p className="min-w-0 flex-1 text-[13.5px]">
        <span className="font-semibold">Tutti i {total} task sono chiusi.</span>{" "}
        <span className="text-muted-foreground">
          {canManage ? "Se non resta altro da fare, segna il progetto come completato: passerà in fondo all'elenco." : "Un admin o il PM può segnare il progetto come completato."}
        </span>
      </p>
      {canManage && (
        <Button
          size="sm"
          className="bg-success text-white hover:bg-success/90"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setProjectStatusAction(projectId, "completato");
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Segna completato
        </Button>
      )}
    </div>
  );
}

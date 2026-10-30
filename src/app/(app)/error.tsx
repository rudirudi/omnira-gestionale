"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="m-6 flex flex-col items-center gap-3 rounded-lg border bg-card p-10 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="font-medium">Qualcosa è andato storto</p>
      <p className="max-w-md text-[13px] text-muted-foreground">
        Non siamo riusciti a caricare questa pagina. Riprova; se il problema continua, segnala il codice {error.digest ?? "—"}.
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}

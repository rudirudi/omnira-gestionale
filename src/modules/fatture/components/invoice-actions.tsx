"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, FileMinus2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCreditNoteAction, deleteDraftAction, duplicateInvoiceAction, refreshInvoicingAction } from "../actions";

export function RefreshButton({ label = "Aggiorna stato", size = "sm" as const }: { label?: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshInvoicingAction();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} {label}
    </Button>
  );
}

export function InvoiceSideActions({ id, canCredit, canDelete }: { id: string; canCredit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const go = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message);
      if (r.data) router.push(`/fatture/${r.data}`);
      else router.push("/fatture");
    });
  return (
    <div className="flex flex-wrap gap-2">
      {canCredit && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => go(() => createCreditNoteAction(id))}>
          <FileMinus2 /> Nota di credito
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={() => go(() => duplicateInvoiceAction(id))}>
        <Copy /> Duplica
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onBlur={() => setConfirm(false)}
          onClick={() => (confirm ? go(() => deleteDraftAction(id)) : setConfirm(true))}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} {confirm ? "Conferma: elimina bozza" : "Elimina bozza"}
        </Button>
      )}
    </div>
  );
}

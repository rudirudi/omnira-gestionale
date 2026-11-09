"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_METHOD } from "@/lib/labels";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { answerPaymentCheckAction } from "../actions";
import type { PaymentCheck } from "../queries";

type Method = "bonifico" | "carta" | "contanti" | "paypal" | "stripe" | "riba" | "altro";
const KEY = "omnira-pagamenti-piu-tardi";
const noop = () => () => {};

/**
 * Alla scadenza dei rinnovi: "è stato pagato?". Si apre da sola una volta al giorno
 * (o da ?pagamenti=1, il link dell'avviso); in dashboard resta il pulsante per riaprirla.
 */
export function PaymentCheckPrompt({ items }: { items: PaymentCheck[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  // Rimandata oggi? (solo nel browser: al primo render sul server vale "no")
  const postponed = React.useSyncExternalStore(
    noop,
    () => {
      try {
        return localStorage.getItem(KEY) === today;
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [manual, setManual] = React.useState<boolean | null>(null);
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState<Method>("bonifico");
  const [paidOn, setPaidOn] = React.useState(today);

  const pending = items.filter((i) => !done.has(i.id));
  const open = pending.length > 0 && (manual ?? (params.get("pagamenti") === "1" || !postponed));

  function close() {
    setManual(false);
    try {
      localStorage.setItem(KEY, today);
    } catch {}
  }

  async function answer(item: PaymentCheck, paid: boolean) {
    setBusy(item.id + (paid ? ":si" : ":no"));
    const res = await answerPaymentCheckAction(item.id, paid, { paidOn, method });
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message);
    setDone((s) => new Set(s).add(item.id));
    router.refresh();
  }

  if (items.length === 0) return null;
  const total = pending.reduce((s, i) => s + i.remaining, 0);

  return (
    <>
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="flex w-full shrink-0 items-center gap-3 rounded-xl border border-money/40 bg-money/[0.08] px-3 py-2 text-left transition-colors hover:bg-money/[0.14]"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-money text-white">
            <HandCoins className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-[13px]">
            <strong className="font-semibold text-money-ink">
              {pending.length === 1 ? "1 rinnovo scaduto" : `${pending.length} rinnovi scaduti`} · {formatEuro(total)}
            </strong>
            <span className="text-muted-foreground"> — sono stati pagati?</span>
          </span>
          <span className="rounded-lg bg-money px-3 py-1.5 text-[12.5px] font-semibold text-white">Rispondi</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setManual(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>È stato pagato?</DialogTitle>
            <DialogDescription>
              Questi rinnovi sono arrivati a scadenza. Se il cliente ha pagato, l&apos;importo va negli incassati; altrimenti resta da incassare.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/60 p-2.5 text-[12.5px]">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Pagato il</span>
              <input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value || today)} className="h-8 rounded-md border bg-background px-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Con</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className="h-8 rounded-md border bg-background px-2">
                {Object.entries(PAYMENT_METHOD).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <span className="pb-1.5 text-muted-foreground">valgono per i pagamenti che segni qui sotto</span>
          </div>

          <ul className="flex flex-col gap-2">
            {pending.map((i) => {
              const late = i.due_date != null && i.due_date < today;
              return (
                <li key={i.id} className={cn("flex flex-col gap-2 rounded-lg border border-l-4 p-3 sm:flex-row sm:items-center", late ? "border-l-destructive" : "border-l-warning")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{i.renewal?.name ?? i.description}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {i.client?.name} · scadenza {formatDate(i.due_date)}
                    </p>
                    <p className="text-[14px] font-semibold tabular">{formatEuro(i.remaining)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" className="bg-money text-white hover:bg-money/90" disabled={!!busy} onClick={() => void answer(i, true)}>
                      {busy === i.id + ":si" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Sì, pagato
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void answer(i, false)}>
                      {busy === i.id + ":no" ? <Loader2 className="animate-spin" /> : <Clock />} No, da incassare
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={close}>
              Più tardi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

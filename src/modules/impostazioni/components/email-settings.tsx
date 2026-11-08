"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { sendTestEmailAction, setEmailNotificationsAction } from "../actions";

/** Interruttore personale: avvisi delle scadenze anche via email */
export function EmailNotificationsToggle({ enabled, email }: { enabled: boolean; email: string }) {
  const [on, setOn] = React.useState(enabled);
  const [pending, start] = React.useTransition();
  return (
    <section className="flex items-start gap-3 border-t pt-6">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Mail className="size-4.5" />
      </span>
      <div className="flex-1">
        <p className="font-medium">Ricevi avvisi via email</p>
        <p className="text-[13px] text-muted-foreground">
          Ogni mattina verso le 8, una sola email a <strong>{email}</strong> con le scadenze da tenere d&apos;occhio. Solo nei giorni in cui c&apos;è qualcosa di nuovo.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Ricevi avvisi via email"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const next = !on;
            setOn(next);
            const r = await setEmailNotificationsAction(next);
            if (r.ok) toast.success(r.message);
            else {
              setOn(!next);
              toast.error(r.error);
            }
          })
        }
        className={cn("relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-success" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
      </button>
    </section>
  );
}

type Row = { created_at: string | null; to_email: string | null; subject: string | null; kind: string | null; status: string | null; http_status: number | null; detail: string | null };

/** Stato dell'invio email (solo amministratori): chiave presente, ultimi invii, email di prova */
export function EmailAdmin({ keyConfigured, rows }: { keyConfigured: boolean; rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const sent = rows.filter((r) => r.created_at);
  return (
    <div className="grid max-w-3xl gap-6">
      <section className={cn("flex items-start gap-3 rounded-xl border p-4", keyConfigured ? "border-success/40 bg-success/[0.06]" : "border-warning/50 bg-warning/15")}>
        {keyConfigured ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <XCircle className="mt-0.5 size-5 text-sales-ink" />}
        <div className="flex-1 text-[13px]">
          <p className="font-semibold">{keyConfigured ? "Invio email configurato" : "Invio email non ancora configurato"}</p>
          <p className="text-muted-foreground">
            {keyConfigured
              ? "La chiave Resend è nel Vault di Supabase. Gli avvisi partono ogni mattina dopo il controllo delle scadenze."
              : "Manca la chiave Resend nel Vault di Supabase: finché non c'è, gli avvisi restano solo nella campanella (e non vanno persi)."}
          </p>
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendTestEmailAction();
              if (r.ok) toast.success(r.message);
              else toast.error(r.error);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Email di prova
        </Button>
      </section>

      {!keyConfigured && (
        <section className="rounded-xl border bg-card p-5 text-[13px] leading-relaxed">
          <p className="mb-3 text-[15px] font-semibold">Come attivarlo</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Su <strong>resend.com</strong> aggiungi il dominio <code>omnirasoft.it</code> (regione EU) e inserisci i record DNS che ti mostra. Attendi che risulti
              <em> Verified</em>.
            </li>
            <li>
              In Resend → <strong>API Keys</strong> → Create, permesso <em>Sending access</em>. Copia la chiave (inizia con <code>re_</code>).
            </li>
            <li>
              Su Supabase → <strong>SQL Editor</strong> esegui (sostituendo la chiave):
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[12px]">select vault.create_secret(&apos;re_LA_TUA_CHIAVE&apos;, &apos;resend_api_key&apos;);</pre>
              La chiave resta cifrata nel database: non va su Vercel né in chat.
            </li>
            <li>Torna qui e premi <strong>Email di prova</strong>.</li>
          </ol>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-semibold">Ultimi invii</p>
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw /> Aggiorna
          </Button>
        </div>
        {sent.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nessuna email inviata finora.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-[13px]">
            {sent.map((r, i) => {
              const ok = r.status === "inviata" && (r.http_status == null || (r.http_status >= 200 && r.http_status < 300));
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <Badge dot tone={ok ? "success" : "danger"}>
                    {ok ? (r.http_status ? "Consegnata a Resend" : "Inviata") : r.status === "senza_chiave" ? "Senza chiave" : "Rifiutata"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{r.subject}</span> <span className="text-muted-foreground">→ {r.to_email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  {!ok && r.detail && <p className="w-full truncate text-xs text-destructive">{r.detail}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

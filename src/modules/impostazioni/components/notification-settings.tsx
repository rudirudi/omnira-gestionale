"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, MessageCircle, RefreshCw, Send, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ActionResult, initialActionState } from "@/lib/action-result";
import { cn, formatDate } from "@/lib/utils";
import {
  saveNotificationPrefsAction,
  sendTestEmailAction,
  sendTestTelegramAction,
  telegramConnectAction,
  telegramDisconnectAction,
  telegramSetupAction,
} from "../actions";

export type NotificationPrefs = {
  email: string;
  email_notifications: boolean;
  notification_email: string | null;
  notify_telegram: boolean;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  notify_whatsapp: boolean;
  whatsapp_number: string | null;
};
type Channels = { email_ready: boolean; telegram_ready: boolean; telegram_bot: string | null };
type LogRow = { created_at: string | null; to_email: string | null; subject: string | null; status: string | null; http_status: number | null; detail: string | null };

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
      router.refresh();
    });
  return { pending, run };
}

/** Preferenze personali: cosa ricevere e dove */
export function NotificationSettings({ prefs, channels }: { prefs: NotificationPrefs; channels: Channels }) {
  const [state, action] = useActionState(saveNotificationPrefsAction, initialActionState);
  useActionToast(state);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k]?.[0] : undefined);
  const [emailOn, setEmailOn] = React.useState(prefs.email_notifications);
  const [mode, setMode] = React.useState<"registrazione" | "altra">(prefs.notification_email ? "altra" : "registrazione");
  const [tgOn, setTgOn] = React.useState(prefs.notify_telegram);
  const [waOn, setWaOn] = React.useState(prefs.notify_whatsapp);
  const { pending, run } = useRun();
  const linked = !!prefs.telegram_chat_id;

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-4">
      <p className="text-[13px] text-muted-foreground">
        Le notifiche compaiono sempre nella campanella in alto. Qui scegli se riceverle anche fuori dal gestionale: avvisi di <strong>scadenze</strong> (domini, hosting, rinnovi) e
        <strong> promemoria</strong> all&apos;ora stabilita.
      </p>

      {/* Email */}
      <Channel icon={<Mail />} title="Email" color="bg-primary/10 text-primary" on={emailOn} onToggle={setEmailOn} name="email_on">
        <div className="flex flex-col gap-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input type="radio" name="email_mode" value="registrazione" checked={mode === "registrazione"} onChange={() => setMode("registrazione")} className="size-4 accent-[var(--primary)]" />
            Email con cui mi sono registrato: <strong>{prefs.email}</strong>
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" name="email_mode" value="altra" checked={mode === "altra"} onChange={() => setMode("altra")} className="size-4 accent-[var(--primary)]" />
            Un&apos;altra email:
            <Input
              name="notification_email"
              type="email"
              defaultValue={prefs.notification_email ?? ""}
              placeholder="es. avvisi@omnirasoft.it"
              disabled={mode !== "altra"}
              aria-invalid={!!err("notification_email") || undefined}
              className="h-8 w-64"
              aria-label="Email per le notifiche"
            />
          </label>
          {err("notification_email") && <p className="text-xs text-destructive">{err("notification_email")}</p>}
          <TestRow ready={channels.email_ready} pending={pending} onTest={() => run(sendTestEmailAction)} notReady="Le email partiranno appena il servizio sarà attivo." />
        </div>
      </Channel>

      {/* Telegram */}
      <Channel icon={<Send />} title="Telegram" color="bg-[#229ED9]/12 text-[#1a83b5]" on={tgOn} onToggle={setTgOn} name="telegram_on" disabled={!linked}>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {linked ? (
            <>
              <Badge dot tone="success">Collegato{prefs.telegram_username ? ` come @${prefs.telegram_username}` : ""}</Badge>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(telegramDisconnectAction)}>
                <Unlink /> Scollega
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={pending || !channels.telegram_ready} onClick={() => run(sendTestTelegramAction)}>
                Messaggio di prova
              </Button>
            </>
          ) : channels.telegram_ready ? (
            <>
              <Button
                type="button"
                size="sm"
                className="bg-[#229ED9] text-white hover:bg-[#1f8fc4]"
                disabled={pending}
                onClick={async () => {
                  const r = await telegramConnectAction();
                  if (r.ok && r.data) {
                    window.open(r.data.url, "_blank", "noopener");
                    toast.success("Su Telegram premi «Avvia»: poi torna qui e aggiorna la pagina");
                  } else if (!r.ok) toast.error(r.error);
                }}
              >
                <Send /> Collega Telegram
              </Button>
              <span className="text-muted-foreground">Si apre Telegram: premi «Avvia» e il collegamento è fatto.</span>
            </>
          ) : (
            <span className="text-muted-foreground">Telegram non è ancora disponibile: potrai collegarlo da qui appena sarà attivo.</span>
          )}
        </div>
      </Channel>

      {/* WhatsApp */}
      <Channel icon={<MessageCircle />} title="WhatsApp" color="bg-[#25D366]/15 text-[#128C7E]" on={waOn} onToggle={setWaOn} name="whatsapp_on">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Input
            name="whatsapp_number"
            defaultValue={prefs.whatsapp_number ?? ""}
            placeholder="+39 333 1234567"
            inputMode="tel"
            aria-invalid={!!err("whatsapp_number") || undefined}
            className="h-8 w-48"
            aria-label="Numero WhatsApp"
          />
          <span className="text-muted-foreground">Salviamo la tua scelta: i messaggi WhatsApp partiranno appena il servizio sarà attivo.</span>
          {err("whatsapp_number") && <p className="w-full text-xs text-destructive">{err("whatsapp_number")}</p>}
        </div>
      </Channel>

      <div>
        <SubmitButton>Salva preferenze</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Channel({
  icon,
  title,
  color,
  on,
  onToggle,
  name,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  name: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-xs transition-colors", on && "border-primary/30")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5", color)}>{icon}</span>
        <p className="flex-1 text-[15px] font-semibold">{title}</p>
        {on && <input type="hidden" name={name} value="on" />}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Ricevi notifiche via ${title}`}
          disabled={disabled}
          title={disabled ? "Prima collega l'account" : undefined}
          onClick={() => onToggle(!on)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-success" : "bg-muted-foreground/30")}
        >
          <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
        </button>
      </div>
      <div className={cn("mt-3 pl-12", !on && "opacity-60")}>{children}</div>
    </section>
  );
}

function TestRow({ ready, pending, onTest, notReady }: { ready: boolean; pending: boolean; onTest: () => void; notReady: string }) {
  return ready ? (
    <div>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onTest}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Email di prova
      </Button>
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">{notReady}</p>
  );
}

/** Solo amministratori: stato dei servizi e ultimi invii (nessuna istruzione tecnica) */
export function NotificationServices({ channels, log }: { channels: Channels; log: LogRow[] }) {
  const { pending, run } = useRun();
  const router = useRouter();
  const rows = log.filter((r) => r.created_at);
  return (
    <section className="grid max-w-3xl gap-4 border-t pt-6">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <ShieldCheck className="size-4.5 text-primary" /> Servizi (visibile solo agli amministratori)
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Service label="Email" ready={channels.email_ready} />
        <Service label={channels.telegram_bot ? `Telegram · @${channels.telegram_bot}` : "Telegram"} ready={channels.telegram_ready} action={<Button type="button" variant="ghost" size="sm" className="h-7" disabled={pending} onClick={() => run(telegramSetupAction)}>Verifica</Button>} />
        <Service label="WhatsApp" ready={false} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold">Ultimi invii</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw /> Aggiorna
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nessun invio finora.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card text-[13px]">
            {rows.map((r, i) => {
              const ok = r.status === "inviata" && (r.http_status == null || (r.http_status >= 200 && r.http_status < 300));
              const tg = r.to_email?.startsWith("telegram:");
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <Badge dot tone={ok ? "success" : r.status === "senza_chiave" ? "neutral" : "danger"}>{ok ? "Inviato" : r.status === "senza_chiave" ? "Servizio non attivo" : "Non consegnato"}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{r.subject}</span> <span className="text-muted-foreground">→ {tg ? "Telegram" : r.to_email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Service({ label, ready, action }: { label: string; ready: boolean; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border p-3 text-[13px]", ready ? "border-success/40 bg-success/[0.06]" : "bg-muted/40")}>
      {ready ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-2.5 rounded-full bg-muted-foreground/40" />}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className={cn("text-xs", ready ? "text-success" : "text-muted-foreground")}>{ready ? "Attivo" : "Non attivo"}</span>
      {action}
    </div>
  );
}

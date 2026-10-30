"use client";

import { useActionState, useRef, useTransition } from "react";
import { Bell, CalendarClock, Mail, MessageSquareText, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-result";
import type { ActivityRow, ActivityType } from "@/lib/database.types";
import { ACTIVITY_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { addActivityAction, toggleActivityDoneAction } from "../actions";

const ICON: Record<ActivityType, typeof Phone> = {
  nota: MessageSquareText,
  chiamata: Phone,
  email: Mail,
  riunione: Users,
  promemoria: Bell,
};

type Activity = ActivityRow & { author: { full_name: string } | null };

function when(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ActivityTimeline({
  activities,
  clientId,
  leadId,
  onChanged,
}: {
  activities: Activity[];
  clientId?: string;
  leadId?: string;
  onChanged?: () => void;
}) {
  const [state, formAction] = useActionState(addActivityAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  useActionToast(state, () => {
    formRef.current?.reset();
    onChanged?.();
  });

  return (
    <div className="flex flex-col gap-5">
      <ActionForm ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        {leadId && <input type="hidden" name="lead_id" value={leadId} />}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select name="type" defaultValue="nota">
            <SelectTrigger className="sm:w-40" aria-label="Tipo di attività">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_TYPE).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="subject" placeholder="Oggetto (es. Call di allineamento)" aria-label="Oggetto" required />
        </div>
        <Textarea name="body" placeholder="Dettagli, decisioni, prossimi passi…" rows={2} aria-label="Dettagli" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <CalendarClock className="size-4" />
            Scadenza
            <Input name="due_at" type="datetime-local" className="h-8 w-auto text-[13px]" />
          </label>
          <SubmitButton size="sm">Registra</SubmitButton>
        </div>
      </ActionForm>

      {activities.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Nessuna attività registrata.</p>
      ) : (
        <ol className="relative flex flex-col gap-0 border-l pl-6">
          {activities.map((a) => {
            const Icon = ICON[a.type];
            const isTodo = !!a.due_at;
            return (
              <li key={a.id} className="relative pb-5 last:pb-0">
                <span className="absolute top-0 -left-[37px] flex size-6 items-center justify-center rounded-full border bg-card">
                  <Icon className="size-3.5 text-muted-foreground" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className={cn("font-medium", a.done_at && isTodo && "text-muted-foreground line-through")}>{a.subject}</p>
                  <span className="text-xs text-muted-foreground">
                    {ACTIVITY_TYPE[a.type]} · {a.author?.full_name ?? "—"} · {when(a.created_at)}
                  </span>
                </div>
                {a.body && <p className="mt-1 text-[13px] whitespace-pre-line text-muted-foreground">{a.body}</p>}
                {isTodo && (
                  <label className="mt-2 inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--primary)]"
                      defaultChecked={!!a.done_at}
                      onChange={(e) =>
                        startTransition(async () => {
                          const r = await toggleActivityDoneAction(a.id, e.target.checked);
                          if (!r.ok) toast.error(r.error);
                          else onChanged?.();
                        })
                      }
                    />
                    Scadenza {when(a.due_at!)}
                  </label>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

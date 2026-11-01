"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, GripVertical, Plus, Target, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { LeadStage } from "@/lib/database.types";
import { LEAD_SOURCE, LEAD_STAGES } from "@/lib/labels";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { TONE } from "@/lib/areas";
import { convertLeadToClientAction, createLeadAction, moveLeadAction } from "../actions";
import type { LeadWithRefs } from "../queries";
import { LeadForm } from "./lead-form";
import { LeadSheet } from "./lead-sheet";

type Team = { id: string; full_name: string }[];

function newPosition(list: LeadWithRefs[], beforeId: string | null) {
  if (list.length === 0) return 0;
  if (!beforeId) return list[list.length - 1]!.position + 1;
  const idx = list.findIndex((l) => l.id === beforeId);
  if (idx <= 0) return list[0]!.position - 1;
  return (list[idx - 1]!.position + list[idx]!.position) / 2;
}

export function LeadBoard({ leads: initial, team, canEdit }: { leads: LeadWithRefs[]; team: Team; canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [leads, setLeads] = React.useState(initial);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<LeadStage | null>(null);
  const [lost, setLost] = React.useState<{ id: string; position: number } | null>(null);
  const [lostReason, setLostReason] = React.useState("");

  // Dati nuovi dal server (dopo revalidate) → sostituiscono lo stato ottimistico
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setLeads(initial);
  }

  const openId = params.get("aperto");
  const newOpen = params.get("nuovo") === "1";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/lead?${next.toString()}`, { scroll: false });
  };

  const byStage = React.useMemo(() => {
    const map = new Map<LeadStage, LeadWithRefs[]>(LEAD_STAGES.map((s) => [s.value, []]));
    for (const l of [...leads].sort((a, b) => a.position - b.position)) map.get(l.stage)!.push(l);
    return map;
  }, [leads]);

  async function commitMove(id: string, stage: LeadStage, position: number, lost_reason?: string) {
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage, position, lost_reason: lost_reason ?? l.lost_reason } : l)));
    const res = await moveLeadAction({ id, stage, position, lost_reason });
    if (!res.ok) {
      setLeads(before);
      toast.error(res.error);
      return;
    }
    if (stage === "vinto") {
      const lead = leads.find((l) => l.id === id);
      if (lead && !lead.client_id) {
        toast.success("Lead vinto!", {
          description: "Vuoi creare il cliente da questo lead?",
          action: {
            label: "Crea cliente",
            onClick: async () => {
              const r = await convertLeadToClientAction(id);
              if (r.ok && r.data) router.push(`/clienti/${r.data.clientId}`);
              else if (!r.ok) toast.error(r.error);
            },
          },
        });
      }
    }
  }

  function onDrop(stage: LeadStage, beforeId: string | null) {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id || id === beforeId) return;
    const column = (byStage.get(stage) ?? []).filter((l) => l.id !== id);
    const position = newPosition(column, beforeId);
    if (stage === "perso") {
      setLost({ id, position });
      return;
    }
    void commitMove(id, stage, position);
  }

  const totals = LEAD_STAGES.map((s) => ({
    ...s,
    items: byStage.get(s.value) ?? [],
    total: (byStage.get(s.value) ?? []).reduce((sum, l) => sum + (l.estimated_value_cents ?? 0), 0),
  }));
  const openLead = leads.find((l) => l.id === openId) ?? null;

  return (
    <>
      {leads.length === 0 && !newOpen ? (
        <EmptyState
          icon={Target}
          title="La pipeline è vuota"
          description="Aggiungi il primo lead: una richiesta dal sito, dal chatbot o un contatto da una fiera."
          action={
            canEdit && (
              <Button onClick={() => setParam("nuovo", "1")}>
                <Plus /> Nuovo lead
              </Button>
            )
          }
        />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {totals.map((col) => (
              <section
                key={col.value}
                aria-label={col.label}
                onDragOver={(e) => {
                  if (!canEdit || !dragId) return;
                  e.preventDefault();
                  setOverStage(col.value);
                }}
                onDragLeave={() => setOverStage((s) => (s === col.value ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(col.value, null);
                }}
                className={cn(
                  "flex min-h-[60vh] flex-col rounded-xl border-t-4 p-2 transition-colors",
                  TONE[col.tone].columnTop,
                  TONE[col.tone].columnBg,
                  overStage === col.value && "ring-2 ring-primary/40",
                )}
              >
                <header className="flex flex-col gap-0.5 px-1.5 pt-1.5 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{col.label}</span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular shadow-xs">{col.items.length}</span>
                  </div>
                  <span className="h-4 text-xs font-medium text-muted-foreground tabular">{col.total ? formatEuro(col.total) : "—"}</span>
                </header>
                <div className="flex flex-col gap-2">
                  {col.items.map((l) => (
                    <article
                      key={l.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        setDragId(l.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onDragOver={(e) => canEdit && dragId && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDrop(col.value, l.id);
                      }}
                      className={cn(
                        "group cursor-pointer rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                        TONE[col.tone].cardBorder,
                        dragId === l.id && "opacity-40",
                      )}
                      onClick={() => setParam("aperto", l.id)}
                    >
                      <div className="flex items-start gap-1.5">
                        <p className="flex-1 text-[13px] leading-snug font-medium">{l.title}</p>
                        {canEdit && <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />}
                      </div>
                      {(l.company_name || l.client) && (
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Building2 className="size-3" /> {l.client?.name ?? l.company_name}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold tabular">{l.estimated_value_cents ? formatEuro(l.estimated_value_cents) : "—"}</span>
                        <div className="flex items-center gap-1.5">
                          {l.expected_close_date && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CalendarDays className="size-3" />
                              {formatDate(l.expected_close_date).slice(0, 5)}
                            </span>
                          )}
                          {l.owner ? <Avatar name={l.owner.full_name} className="size-5 text-[9px]" /> : <UserRound className="size-3.5 text-muted-foreground/60" />}
                        </div>
                      </div>
                      <p className="mt-2 flex flex-wrap gap-1"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{LEAD_SOURCE[l.source]}</span>{l.service_interest && <span className="rounded bg-sales/20 px-1.5 py-0.5 text-[10px] font-medium text-sales-ink">{l.service_interest}</span>}</p>
                      {l.stage === "perso" && l.lost_reason && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-destructive">Motivo: {l.lost_reason}</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={(o) => setParam("nuovo", o ? "1" : null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuovo lead</DialogTitle>
            <DialogDescription>Entra nella colonna &quot;Nuovo&quot; della pipeline.</DialogDescription>
          </DialogHeader>
          <LeadForm action={createLeadAction} team={team} submitLabel="Crea lead" onDone={() => setParam("nuovo", null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!lost} onOpenChange={(o) => !o && setLost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perché il lead è perso?</DialogTitle>
            <DialogDescription>Serve per capire quali offerte e canali funzionano meglio.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Es. Budget insufficiente, scelto un concorrente, progetto rimandato…"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLost(null)}>
              Annulla
            </Button>
            <Button
              disabled={!lostReason.trim()}
              onClick={() => {
                if (!lost) return;
                void commitMove(lost.id, "perso", lost.position, lostReason.trim());
                setLost(null);
                setLostReason("");
              }}
            >
              Segna come perso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadSheet lead={openLead} team={team} canEdit={canEdit} onClose={() => setParam("aperto", null)} />
      {openId && !openLead && leads.length > 0 && (
        <p className="sr-only">
          Lead non trovato. <Link href="/lead">Torna alla pipeline</Link>
        </p>
      )}
    </>
  );
}

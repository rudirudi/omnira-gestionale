"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { DiscussionRow } from "@/lib/database.types";
import { replaceUrl } from "@/lib/url-state";
import { cn } from "@/lib/utils";
import { createDiscussionAction, deleteDiscussionAction, setDiscussionStatusAction, updateDiscussionAction } from "../actions";
import { DiscussionForm } from "./discussion-form";

type Option = { id: string; name: string };
type Lists = { team: { id: string; full_name: string }[]; projects: Option[]; clients: Option[] };

/** "Nuovo punto": si apre anche da ?nuovo=1 (link dalla dashboard) */
export function NewDiscussionDialog({ team, projects, clients, defaults }: Lists & { defaults?: Partial<DiscussionRow> }) {
  const params = useSearchParams();
  const open = params.get("nuovo") === "1";
  const setOpen = (o: boolean) => {
    const next = new URLSearchParams(params);
    if (o) next.set("nuovo", "1");
    else next.delete("nuovo");
    replaceUrl(`/discussioni?${next.toString()}`);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nuovo punto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apri un punto o una discussione</DialogTitle>
          <DialogDescription>Il team riceve un avviso; il responsabile lo porta avanti fino a quando è risolto.</DialogDescription>
        </DialogHeader>
        <DiscussionForm action={createDiscussionAction} defaults={defaults} team={team} projects={projects} clients={clients} submitLabel="Apri" />
      </DialogContent>
    </Dialog>
  );
}

export function EditDiscussionDialog({ discussion, team, projects, clients }: Lists & { discussion: DiscussionRow }) {
  const [open, setOpen] = React.useState(false);
  const action = React.useMemo(() => updateDiscussionAction.bind(null, discussion.id), [discussion.id]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil /> Modifica
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica #{discussion.number}</DialogTitle>
          <DialogDescription>Titolo, descrizione, responsabile e collegamenti.</DialogDescription>
        </DialogHeader>
        <DiscussionForm action={action} defaults={discussion} team={team} projects={projects} clients={clients} submitLabel="Salva" onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Chiusura con esito, oppure riapertura */
export function StatusControl({ id, status, resolution }: { id: string; status: DiscussionRow["status"]; resolution: string | null }) {
  const router = useRouter();
  const [text, setText] = React.useState(resolution ?? "");
  const [pending, start] = React.useTransition();
  const run = (next: "aperto" | "risolto") =>
    start(async () => {
      const res = await setDiscussionStatusAction(id, next, text);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });

  if (status === "risolto") {
    return (
      <Button variant="outline" className="w-full" onClick={() => run("aperto")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Riapri
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="esito" className="text-[12px] font-medium text-muted-foreground">
        Esito (facoltativo)
      </label>
      <Textarea id="esito" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} placeholder="Cosa si è deciso o come si è risolto" />
      <Button className="w-full bg-success text-white hover:bg-success/90" onClick={() => run("risolto")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Segna come risolto
      </Button>
    </div>
  );
}

export function DeleteDiscussionButton({ id }: { id: string }) {
  const [confirm, setConfirm] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground", confirm && "text-destructive")}
      disabled={pending}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        start(async () => {
          const res = await deleteDiscussionAction(id);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
      onBlur={() => setConfirm(false)}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} {confirm ? "Conferma eliminazione" : "Elimina"}
    </Button>
  );
}

const STATI = [
  { value: "", label: "Tutti" },
  { value: "aperti", label: "Aperti" },
  { value: "risolti", label: "Risolti" },
];
const TIPI = [
  { value: "", label: "Tutti i tipi" },
  { value: "punto", label: "Punti aperti" },
  { value: "discussione", label: "Discussioni" },
];

export function DiscussionFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`/discussioni?${next.toString()}`, { scroll: false });
  };
  const group = (key: string, items: typeof STATI, label: string) => (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label={label}>
      {items.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={(params.get(key) ?? "") === s.value}
          onClick={() => set(key, s.value)}
          className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", (params.get(key) ?? "") === s.value && "bg-muted text-foreground")}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {group("stato", STATI, "Filtra per stato")}
      {group("tipo", TIPI, "Filtra per tipo")}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={params.get("miei") === "1"} onChange={(e) => set("miei", e.target.checked ? "1" : "")} className="size-4 accent-[var(--primary)]" />
        Solo i miei
      </label>
    </div>
  );
}

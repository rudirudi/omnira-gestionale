import Link from "next/link";
import { Briefcase, CalendarDays, CheckCircle2, CircleDot, Flag, MessageCircle, MessagesSquare, Users } from "lucide-react";
import type { DiscussionKind, DiscussionPriority, DiscussionStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import type { DiscussionListItem } from "../queries";

// Colori per funzione: giallo = punto da chiudere, blu = discussione, verde = risolto, rosso = urgente/scaduto
export const KIND: Record<DiscussionKind, { label: string; short: string; icon: typeof CircleDot; tile: string; text: string; bar: string }> = {
  punto: { label: "Punto aperto", short: "Punto", icon: CircleDot, tile: "bg-sales text-on-warning", text: "text-sales-ink", bar: "border-l-warning" },
  discussione: { label: "Discussione", short: "Discussione", icon: MessagesSquare, tile: "bg-work text-white", text: "text-work-ink", bar: "border-l-work" },
};

export const PRIORITY: Record<DiscussionPriority, string> = { alta: "Alta", normale: "Normale", bassa: "Bassa" };

export function StatusBadge({ status }: { status: DiscussionStatus }) {
  return status === "risolto" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11.5px] font-semibold text-money-ink">
      <CheckCircle2 className="size-3.5" /> Risolto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11.5px] font-semibold text-sales-ink">
      <span className="size-1.5 rounded-full bg-warning" /> Aperto
    </span>
  );
}

export function KindIcon({ kind, resolved = false, size = "md" }: { kind: DiscussionKind; resolved?: boolean; size?: "sm" | "md" }) {
  const k = KIND[kind];
  const Icon = resolved ? CheckCircle2 : k.icon;
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", resolved ? "bg-success text-white" : k.tile, size === "sm" ? "size-7" : "size-9")} title={k.label}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4.5"} />
    </span>
  );
}

export function dueState(due: string | null, status: DiscussionStatus) {
  if (!due) return null;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const late = status === "aperto" && due < today;
  const label = new Date(`${due}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  return { late, label: due === today ? "Oggi" : label };
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} g fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

/** Riga di un punto/discussione: usata nell'elenco e nella dashboard */
export function DiscussionRowItem({ d, meId, compact = false }: { d: DiscussionListItem; meId: string; compact?: boolean }) {
  const resolved = d.status === "risolto";
  const due = dueState(d.due_date, d.status);
  const mine = d.owner_id === meId;
  return (
    <Link
      href={`/discussioni/${d.id}`}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
        resolved ? "border-l-success opacity-80" : d.priority === "alta" ? "border-l-destructive" : KIND[d.kind].bar,
      )}
    >
      <KindIcon kind={d.kind} resolved={resolved} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">#{d.number}</span>
          <span className={cn("truncate text-[13.5px] font-semibold", resolved && "text-muted-foreground line-through decoration-1")}>{d.title}</span>
          {d.priority === "alta" && !resolved && <Flag className="size-3.5 shrink-0 fill-current text-destructive" aria-label="Priorità alta" />}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {!compact && <StatusBadge status={d.status} />}
          <span className={cn("rounded-md px-1.5 py-0.5 font-medium", mine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {d.owner ? (mine ? "Tocca a te" : d.owner.full_name) : "Senza responsabile"}
          </span>
          {d.project && (
            <span className="flex max-w-56 items-center gap-1 rounded-md bg-work/10 px-1.5 py-0.5 font-medium text-work-ink">
              <Briefcase className="size-3 shrink-0" />
              <span className="truncate">{d.project.name}</span>
            </span>
          )}
          {d.client && (
            <span className="flex max-w-48 items-center gap-1 rounded-md bg-sales/20 px-1.5 py-0.5 font-medium text-sales-ink">
              <Users className="size-3 shrink-0" />
              <span className="truncate">{d.client.name}</span>
            </span>
          )}
          {due && (
            <span className={cn("flex items-center gap-1", due.late ? "font-semibold text-destructive" : "text-muted-foreground")}>
              <CalendarDays className="size-3" /> {due.late ? `Scaduto ${due.label}` : due.label}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted-foreground">
        <span className={cn("flex items-center gap-1", d.replies_count > 0 && "font-semibold text-foreground")}>
          <MessageCircle className="size-3.5" /> {d.replies_count}
        </span>
        <span>{ago(d.last_activity_at)}</span>
      </div>
    </Link>
  );
}

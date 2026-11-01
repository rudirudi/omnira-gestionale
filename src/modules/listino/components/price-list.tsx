"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff, Plus, Repeat, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/app/action-form";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { useActionToast } from "@/components/app/use-action-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, initialActionState } from "@/lib/action-result";
import type { ServiceCategory } from "@/lib/database.types";
import { QUOTE_UNITS, RENEWAL_FREQUENCY, SERVICE_CATEGORIES } from "@/lib/labels";
import { cn, formatEuro } from "@/lib/utils";
import { createServiceAction, deleteServiceAction, setServiceActiveAction, updateServiceAction } from "../actions";
import type { ServiceItem } from "../queries";

const PER_UNIT: Record<string, string> = { ore: "ora", giorni: "giorno", mesi: "mese", pagine: "pagina", anno: "anno" };
const PER_FREQ: Record<string, string> = { mensile: "mese", trimestrale: "trimestre", semestrale: "semestre", annuale: "anno", biennale: "2 anni" };

/** "1.500,00 €", "45,00 € / ora", "120,00 € / anno" — null se il prezzo è da definire */
export const priceLabel = (s: Pick<ServiceItem, "price_cents" | "unit" | "frequency">) => {
  if (s.price_cents == null) return null;
  const per = s.frequency ? PER_FREQ[s.frequency] : PER_UNIT[s.unit];
  return `${formatEuro(s.price_cents)}${per ? ` / ${per}` : ""}`;
};

export function PriceList({ services, isAdmin }: { services: ServiceItem[]; isAdmin: boolean }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ServiceCategory | "tutte">("tutte");
  const [showHidden, setShowHidden] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceItem | "new" | null>(null);
  const [, start] = React.useTransition();

  const q = query.trim().toLowerCase();
  const shown = services.filter(
    (s) =>
      (showHidden || s.active) &&
      (category === "tutte" || s.category === category) &&
      (!q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q)),
  );
  const missing = services.filter((s) => s.active && s.price_cents == null).length;
  const groups = SERVICE_CATEGORIES.map((c) => ({ ...c, items: shown.filter((s) => s.category === c.value) })).filter((g) => g.items.length);
  const counts = new Map(SERVICE_CATEGORIES.map((c) => [c.value, services.filter((s) => s.active && s.category === c.value).length]));

  const run = (p: Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(r.message);
        after?.();
      } else toast.error(r.error);
    });

  return (
    <div className="flex flex-col gap-5">
      {missing > 0 && (
        <p className="rounded-lg border border-warning/50 bg-warning/15 px-4 py-2.5 text-[13px] text-sales-ink">
          <strong>{missing} servizi senza prezzo.</strong> Inserisci il vostro prezzo standard: nei preventivi resta sempre modificabile caso per caso.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un servizio…" className="h-8 max-w-xs" aria-label="Cerca nel listino" />
        <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory | "tutte")}>
          <SelectTrigger className="h-8 w-56" aria-label="Categoria"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le categorie</SelectItem>
            {SERVICE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label} ({counts.get(c.value) ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Mostra nascosti
        </label>
        <Button size="sm" className="ml-auto bg-sales text-on-warning hover:bg-sales/90" onClick={() => setEditing("new")}>
          <Plus /> Nuovo servizio
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState area="sales" icon={Tags} title={services.length ? "Nessun servizio con questi filtri" : "Listino vuoto"} description="Aggiungi i servizi che vendete con il prezzo standard: li inserisci nei preventivi con un clic." className="py-10" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((g) => (
            <section key={g.value} className="overflow-hidden rounded-xl border border-[oklch(0.62_0.145_68)] bg-card shadow-xs">
              <header className="flex items-center justify-between bg-gradient-to-r from-[oklch(0.58_0.14_62)] to-[oklch(0.66_0.15_75)] px-4 py-2 text-white">
                <h2 className="text-[13.5px] font-semibold">{g.label}</h2>
                <span className="text-xs text-white/85">{g.items.length}</span>
              </header>
              <ul className="divide-y">
                {g.items.map((s) => {
                  const price = priceLabel(s);
                  return (
                    <li key={s.id} className={cn("group flex items-start gap-3 px-4 py-3", !s.active && "opacity-55")}>
                      <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                          {s.name}
                          {s.frequency && (
                            <Badge tone="success" className="gap-1">
                              <Repeat className="size-3" /> Canone
                            </Badge>
                          )}
                          {!s.active && <Badge tone="neutral">Nascosto</Badge>}
                        </span>
                        {s.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{s.description}</span>}
                      </button>
                      <span className="shrink-0 pt-0.5 text-right">
                        {price ? (
                          <span className="text-[13.5px] font-semibold tabular">{price}</span>
                        ) : (
                          <button type="button" onClick={() => setEditing(s)} className="rounded-md bg-warning/25 px-2 py-0.5 text-xs font-semibold text-sales-ink hover:bg-warning/40">
                            Prezzo da definire
                          </button>
                        )}
                      </span>
                      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label={s.active ? "Nascondi dai preventivi" : "Riattiva"}
                          title={s.active ? "Nascondi dai preventivi" : "Riattiva"}
                          onClick={() => run(setServiceActiveAction(s.id, !s.active))}
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&_svg]:size-3.5"
                        >
                          {s.active ? <EyeOff /> : <Eye />}
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            aria-label="Elimina servizio"
                            onClick={() => run(deleteServiceAction(s.id))}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive [&_svg]:size-3.5"
                          >
                            <Trash2 />
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nuovo servizio" : "Modifica servizio"}</DialogTitle>
            <DialogDescription>Il prezzo è quello standard, IVA esclusa: nel preventivo puoi sempre cambiarlo.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ServiceForm
              key={editing === "new" ? "new" : editing.id}
              action={editing === "new" ? createServiceAction : updateServiceAction.bind(null, editing.id)}
              defaults={editing === "new" ? { category: category === "tutte" ? "altro" : category } : editing}
              submitLabel={editing === "new" ? "Aggiungi al listino" : "Salva"}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({
  action,
  defaults,
  submitLabel,
  onDone,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  defaults: Partial<ServiceItem>;
  submitLabel: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, onDone);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const price = defaults.price_cents != null ? (defaults.price_cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "";
  return (
    <ActionForm action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome *" htmlFor="sv_name" error={err("name")} className="sm:col-span-2">
        <Input id="sv_name" name="name" defaultValue={defaults.name ?? ""} placeholder="Es. Sito vetrina" autoFocus />
      </Field>
      <Field label="Categoria" htmlFor="sv_cat">
        <Select name="category" defaultValue={defaults.category ?? "altro"}>
          <SelectTrigger id="sv_cat"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SERVICE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tipo" htmlFor="sv_freq">
        <Select name="frequency" defaultValue={defaults.frequency ?? "una_tantum"}>
          <SelectTrigger id="sv_freq"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="una_tantum">Una tantum</SelectItem>
            {Object.entries(RENEWAL_FREQUENCY).map(([v, f]) => <SelectItem key={v} value={v}>Canone {f.label.toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Prezzo standard (€)" htmlFor="sv_price" error={err("price")} hint="Vuoto = da definire">
        <Input id="sv_price" name="price" defaultValue={price} inputMode="decimal" placeholder="Es. 1.500" className="text-base font-semibold tabular" />
      </Field>
      <Field label="Unità" htmlFor="sv_unit">
        <Select name="unit" defaultValue={defaults.unit ?? "pz"}>
          <SelectTrigger id="sv_unit"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QUOTE_UNITS.map((u) => <SelectItem key={u} value={u}>{u === "pz" ? "pz (a corpo)" : u}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Descrizione per il preventivo" htmlFor="sv_desc" className="sm:col-span-2" hint="Compare sotto la voce nel preventivo: cosa è incluso.">
        <Textarea id="sv_desc" name="description" rows={3} defaultValue={defaults.description ?? ""} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton className="bg-sales text-on-warning hover:bg-sales/90">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

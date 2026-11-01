"use client";

import * as React from "react";
import { HandCoins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatEuro } from "@/lib/utils";
import { createExpenseAction } from "../actions";
import type { ExpenseItem } from "../queries";
import { ExpenseForm, type Person, type ProjectOpt } from "./expense-forms";
import { ExpenseList } from "./expenses-view";

/** Costi di un progetto e margine (incassato − costi) nella scheda Pagamenti */
export function ProjectCosts({
  projectId,
  items,
  paidCents,
  people,
  projects,
  meId,
  canManage,
  isAdmin,
}: {
  projectId: string;
  items: ExpenseItem[];
  paidCents: number;
  people: Person[];
  projects: ProjectOpt[];
  meId: string;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [creating, setCreating] = React.useState(false);
  const costs = items.reduce((s, e) => s + e.amount_cents, 0);
  const margin = paidCents - costs;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <HandCoins className="size-4 text-money-ink" /> Costi del progetto
        </h2>
        <span className="text-[13px] text-muted-foreground tabular">
          {formatEuro(costs)} spesi · margine sull&apos;incassato{" "}
          <span className={cn("font-semibold", margin >= 0 ? "text-success" : "text-destructive")}>{formatEuro(margin)}</span>
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> Aggiungi costo
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nessun costo registrato su questo progetto (collaboratori, licenze, plugin…).</p>
      ) : (
        <ExpenseList items={items} people={people} projects={projects} meId={meId} canManage={canManage} isAdmin={isAdmin} showPerson={people.length > 1} showProject={false} />
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo costo del progetto</DialogTitle>
            <DialogDescription>Finisce anche nelle Spese, collegato a questo progetto.</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            action={createExpenseAction}
            people={people}
            projects={projects}
            canChoosePerson={canManage && people.length > 1}
            meId={meId}
            defaults={{ project_id: projectId, category: "collaboratori" }}
            submitLabel="Registra costo"
            onDone={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

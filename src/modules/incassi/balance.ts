import type { ReceivableState } from "@/lib/labels";

/** Calcola pagato, residuo e stato di un importo dai suoi pagamenti */
export function withBalance<T extends { amount_cents: number; due_date: string | null; payments: { amount_cents: number; paid_on: string }[] }>(r: T) {
  const paid = r.payments.reduce((s, p) => s + p.amount_cents, 0);
  const remaining = Math.max(0, r.amount_cents - paid);
  const today = new Date().toISOString().slice(0, 10);
  const state: ReceivableState =
    remaining === 0 ? "pagato" : r.due_date && r.due_date < today ? "scaduto" : paid > 0 ? "parziale" : "da_pagare";
  const lastPaidOn = r.payments.reduce<string | null>((m, p) => (!m || p.paid_on > m ? p.paid_on : m), null);
  return { ...r, paid, remaining, state, lastPaidOn };
}

export function totals(items: { amount_cents: number; paid: number; remaining: number; state: ReceivableState }[]) {
  return {
    total: items.reduce((s, r) => s + r.amount_cents, 0),
    paid: items.reduce((s, r) => s + r.paid, 0),
    remaining: items.reduce((s, r) => s + r.remaining, 0),
    overdue: items.filter((r) => r.state === "scaduto").reduce((s, r) => s + r.remaining, 0),
    overdueCount: items.filter((r) => r.state === "scaduto").length,
  };
}

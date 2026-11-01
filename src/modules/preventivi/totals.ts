import type { QuoteStatus, RenewalFrequency } from "@/lib/database.types";
import { RENEWAL_FREQUENCY, type QuoteDisplayState } from "@/lib/labels";

export type ItemLike = { quantity: number; unit_price_cents: number; frequency: RenewalFrequency | null };

export const lineTotal = (i: Pick<ItemLike, "quantity" | "unit_price_cents">) => Math.round(Number(i.quantity) * i.unit_price_cents);

/**
 * Totali del preventivo. Le voci una tantum fanno imponibile, sconto e IVA;
 * i canoni ricorrenti sono separati (si pagano a ogni periodo, non all'accettazione).
 */
export function quoteTotals(items: ItemLike[], discountCents: number, vatRate: number) {
  const oneOff = items.filter((i) => !i.frequency).reduce((s, i) => s + lineTotal(i), 0);
  const discount = Math.min(discountCents, oneOff);
  const net = oneOff - discount;
  const vat = Math.round((net * Number(vatRate)) / 100);
  const byFreq = new Map<RenewalFrequency, number>();
  for (const i of items) if (i.frequency) byFreq.set(i.frequency, (byFreq.get(i.frequency) ?? 0) + lineTotal(i));
  const recurring = [...byFreq.entries()].map(([frequency, cents]) => ({ frequency, net: cents, gross: Math.round(cents * (1 + Number(vatRate) / 100)) }));
  const recurringYearly = recurring.reduce((s, r) => s + r.net * RENEWAL_FREQUENCY[r.frequency]!.perYear, 0);
  return { oneOff, discount, net, vat, total: net + vat, recurring, recurringYearly };
}

export function displayState(q: { status: QuoteStatus; valid_until: string }): QuoteDisplayState {
  const today = new Date().toISOString().slice(0, 10);
  return q.status === "inviato" && q.valid_until < today ? "scaduto" : q.status;
}

/** "1.500,50" / "1500.5" / "1500" → centesimi (null se non valido) */
export function parseEuro(v: string): number | null {
  const t = v.replace(/\s|€/g, "").trim();
  if (!t) return 0;
  const normalized = t.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const euroField = (cents: number) =>
  (cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);

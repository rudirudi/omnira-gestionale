import Link from "next/link";
import type { ReactNode } from "react";

// Codici del gestionale (P-2026-026 progetto, P-2026-026-4 task) e indirizzi web
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|\b([A-Z]{1,5}-\d{4}-\d{3}(?:-\d{1,5})?)\b/g;

/** Testo del messaggio con link cliccabili; i ritorni a capo li gestisce whitespace-pre-wrap */
export function renderBody(text: string, mine: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const cls = mine ? "font-medium underline underline-offset-2" : "font-medium text-primary underline underline-offset-2";
    if (m[1]) {
      out.push(
        <a key={i} href={m[1]} target="_blank" rel="noopener noreferrer" className={cls}>
          {m[1]}
        </a>,
      );
    } else {
      out.push(
        <Link key={i} href={`/vai/${m[2]}`} className={`${cls} whitespace-nowrap`} title="Apri nel gestionale">
          {m[2]}
        </Link>,
      );
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const TZ = "Europe/Rome";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function dayLabel(iso: string) {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (k === today) return "Oggi";
  if (k === yesterday) return "Ieri";
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

export function sameDay(a: string, b: string) {
  return dayKey(a) === dayKey(b);
}

/** Orario compatto per l'elenco conversazioni */
export function shortWhen(iso: string) {
  const k = dayKey(iso);
  if (k === dayKey(new Date().toISOString())) return timeLabel(iso);
  if (k === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return "Ieri";
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: TZ });
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

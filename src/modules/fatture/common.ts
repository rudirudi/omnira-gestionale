/** Parti della fattura elettronica usabili anche nel browser (nessuna dipendenza da Node) */

export type Party = {
  name: string;
  vat?: string | null;
  taxCode?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

export type Company = Party & {
  taxRegime: string;
  reaOffice?: string | null;
  reaNumber?: string | null;
  iban?: string | null;
};

export type Customer = Party & { sdiCode?: string | null; pec?: string | null };

export type Line = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  vatNature?: string | null;
};

export type InvoiceInput = {
  docType: "TD01" | "TD02" | "TD04" | "TD06";
  number: number;
  year: number;
  date: string; // YYYY-MM-DD
  attempt: number; // per un nome file nuovo a ogni reinvio
  causale?: string | null;
  paymentMethod: string;
  paymentDue?: string | null;
  iban?: string | null;
  related?: { number: string; date: string } | null;
  lines: Line[];
};

/** Diciture standard per le operazioni senza IVA (obbligatorie in fattura) */
export const NATURES: Record<string, { label: string; ref: string }> = {
  N1: { label: "N1 – Escluse ex art. 15", ref: "Escluse ex art. 15 DPR 633/72" },
  "N2.1": { label: "N2.1 – Non soggette (artt. 7-7septies)", ref: "Non soggette ad IVA ai sensi degli artt. da 7 a 7-septies DPR 633/72" },
  "N2.2": { label: "N2.2 – Non soggette (forfettario e altri casi)", ref: "Operazione in franchigia da IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014" },
  "N3.1": { label: "N3.1 – Non imponibili: esportazioni", ref: "Non imponibile art. 8 DPR 633/72" },
  "N3.2": { label: "N3.2 – Non imponibili: cessioni intracomunitarie", ref: "Non imponibile art. 41 DL 331/93" },
  "N3.4": { label: "N3.4 – Non imponibili: assimilate alle esportazioni", ref: "Non imponibile art. 8-bis DPR 633/72" },
  "N3.5": { label: "N3.5 – Non imponibili: dichiarazione d'intento", ref: "Non imponibile art. 8, c. 1, lett. c) DPR 633/72 a seguito di dichiarazione d'intento" },
  "N3.6": { label: "N3.6 – Non imponibili: altre", ref: "Operazione non imponibile" },
  N4: { label: "N4 – Esenti", ref: "Esente art. 10 DPR 633/72" },
  N5: { label: "N5 – Regime del margine", ref: "Regime del margine" },
  "N6.7": { label: "N6.7 – Reverse charge: prestazioni settore edile", ref: "Inversione contabile art. 17, c. 6, lett. a) DPR 633/72" },
  "N6.9": { label: "N6.9 – Reverse charge: altri casi", ref: "Inversione contabile art. 17 DPR 633/72" },
  N7: { label: "N7 – IVA assolta in altro stato UE", ref: "IVA assolta in altro stato UE" },
};

export const DOC_TYPES: Record<InvoiceInput["docType"], string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD04: "Nota di credito",
  TD06: "Parcella",
};

export const PAYMENT_METHODS: Record<string, string> = {
  MP05: "Bonifico",
  MP08: "Carta di pagamento",
  MP01: "Contanti",
  MP02: "Assegno",
  MP12: "RIBA",
  MP19: "SEPA Direct Debit",
  MP23: "PagoPA",
};

export const TAX_REGIMES: Record<string, string> = {
  RF01: "Ordinario",
  RF19: "Forfettario (L. 190/2014)",
  RF02: "Contribuenti minimi",
};

export const lineNet = (l: Line) => Math.round(l.quantity * l.unitPriceCents);

/** Riepilogo per aliquota/natura, con IVA arrotondata per gruppo (come nel database) */
export function summary(lines: Line[]) {
  const groups = new Map<string, { rate: number; nature: string | null; net: number }>();
  for (const l of lines) {
    const key = `${l.vatRate}|${l.vatRate > 0 ? "" : (l.vatNature ?? "")}`;
    const g = groups.get(key) ?? { rate: l.vatRate, nature: l.vatRate > 0 ? null : (l.vatNature ?? null), net: 0 };
    g.net += lineNet(l);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, vat: Math.round((g.net * g.rate) / 100) }));
  const net = rows.reduce((s, r) => s + r.net, 0);
  const vat = rows.reduce((s, r) => s + r.vat, 0);
  return { rows, net, vat, total: net + vat };
}

/** Bollo virtuale da 2 € se le operazioni senza IVA superano 77,47 € (forfettario, esenti, non imponibili) */
export function needsStamp(lines: Line[]) {
  const exempt = lines.filter((l) => l.vatRate === 0 && l.vatNature && /^(N2\.2|N3\.5|N3\.6|N4|N2\.1)$/.test(l.vatNature)).reduce((s, l) => s + lineNet(l), 0);
  return exempt > 7747;
}


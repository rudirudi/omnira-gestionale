/**
 * FatturaPA (formato FPR12, specifiche 1.2.x): costruzione dell'XML da inviare allo SDI
 * e lettura delle fatture ricevute (XML semplice o firmato .p7m).
 * Nessuna dipendenza dal server: si usa sia lato server sia nei test.
 */
import { XMLParser } from "fast-xml-parser";
import { type Company, type Customer, type InvoiceInput, type Party, NATURES, lineNet, needsStamp, summary } from "./common";

export * from "./common";

/** Lo SDI accetta solo caratteri Latin-1: converto quelli tipografici e tolgo il resto (emoji ecc.) */
const clean = (s: string) =>
  s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/€/g, "EUR")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
const esc = (s: string) => clean(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const money = (cents: number) => (cents / 100).toFixed(2);
const qty = (n: number) => n.toFixed(2);
const rate = (n: number) => n.toFixed(2);
const digits = (s?: string | null) => (s ?? "").replace(/\s+/g, "").toUpperCase();
const vatCode = (s?: string | null) => digits(s).replace(/^[A-Z]{2}(?=\d)/, "");
const tag = (name: string, value: string | null | undefined) => (value === null || value === undefined || value === "" ? "" : `<${name}>${esc(value)}</${name}>`);
const cut = (s: string, n: number) => {
  const c = clean(s);
  return c.length > n ? c.slice(0, n) : c;
};

/** Progressivo di 5 caratteri: anno, numero e tentativo, così ogni reinvio ha un nome file nuovo */
export function progressivo(year: number, number: number, attempt: number) {
  return ((year % 100) * 1_000_000 + number * 10 + (attempt % 10)).toString(36).toUpperCase().padStart(5, "0").slice(-5);
}

export function fileName(company: Company, inv: Pick<InvoiceInput, "year" | "number" | "attempt">) {
  const id = vatCode(company.vat) || digits(company.taxCode);
  return `IT${id}_${progressivo(inv.year, inv.number, inv.attempt)}.xml`;
}

const isItaly = (c?: string | null) => !c || c.toUpperCase() === "IT";

/** Controlli prima dell'invio: dati mancanti scritti in italiano semplice */
export function checkInvoice(company: Company, customer: Customer, inv: InvoiceInput): string[] {
  const e: string[] = [];
  if (!vatCode(company.vat)) e.push("Manca la partita IVA dell'azienda (Impostazioni → Dati fiscali)");
  if (!company.address || !company.zip || !company.city) e.push("Manca l'indirizzo completo dell'azienda (via, CAP, comune)");
  if (isItaly(company.country) && company.province && !/^[A-Z]{2}$/i.test(company.province)) e.push("La provincia dell'azienda va scritta con la sigla di 2 lettere (es. TR)");
  if (!customer.name) e.push("Manca la ragione sociale del cliente");
  if (!vatCode(customer.vat) && !digits(customer.taxCode)) e.push("Il cliente non ha né partita IVA né codice fiscale");
  if (!customer.address || !customer.city) e.push("Manca l'indirizzo del cliente (via e comune)");
  if (isItaly(customer.country) && !/^\d{5}$/.test(customer.zip ?? "")) e.push("Il CAP del cliente deve essere di 5 cifre");
  if (isItaly(customer.country) && customer.province && !/^[A-Z]{2}$/i.test(customer.province)) e.push("La provincia del cliente va scritta con la sigla di 2 lettere");
  if (customer.sdiCode && !/^[A-Z0-9]{7}$/i.test(customer.sdiCode)) e.push("Il codice destinatario del cliente deve avere 7 caratteri");
  if (!inv.lines.length) e.push("La fattura non ha righe");
  inv.lines.forEach((l, i) => {
    if (!l.description.trim()) e.push(`Riga ${i + 1}: manca la descrizione`);
    if (l.vatRate === 0 && !l.vatNature) e.push(`Riga ${i + 1}: senza IVA serve la natura dell'operazione (es. N2.2)`);
  });
  const s = summary(inv.lines);
  if (s.total <= 0 && inv.docType !== "TD04") e.push("Il totale deve essere maggiore di zero");
  if (inv.docType === "TD04" && !inv.related) e.push("La nota di credito deve indicare la fattura a cui si riferisce");
  if (inv.paymentMethod === "MP05" && !(inv.iban || company.iban)) e.push("Per il bonifico serve l'IBAN (Impostazioni → Dati fiscali)");
  return e;
}

function sede(p: Party, foreign: boolean) {
  return `<Sede>${tag("Indirizzo", cut(p.address ?? "", 60))}${tag("CAP", foreign ? "00000" : (p.zip ?? ""))}${tag("Comune", cut(p.city ?? "", 60))}${foreign ? "" : tag("Provincia", p.province?.toUpperCase())}${tag("Nazione", (p.country || "IT").toUpperCase())}</Sede>`;
}

export function buildXml(company: Company, customer: Customer, inv: InvoiceInput): string {
  const s = summary(inv.lines);
  const custForeign = !isItaly(customer.country);
  const custVat = vatCode(customer.vat);
  const custCountry = (customer.country || "IT").toUpperCase();
  const code = custForeign ? "XXXXXXX" : (customer.sdiCode?.toUpperCase() || "0000000");
  const pec = !custForeign && code === "0000000" && customer.pec ? customer.pec : null;
  const prog = progressivo(inv.year, inv.number, inv.attempt);
  const stamp = needsStamp(inv.lines);
  const causali = clean(inv.causale ?? "").trim().match(/[\s\S]{1,200}/g) ?? [];
  const iban = (inv.iban || company.iban || "").replace(/\s+/g, "").toUpperCase();

  const lines = inv.lines
    .map(
      (l, i) =>
        `<DettaglioLinee><NumeroLinea>${i + 1}</NumeroLinea>${tag("Descrizione", cut(l.description.trim(), 1000))}<Quantita>${qty(l.quantity)}</Quantita><PrezzoUnitario>${money(l.unitPriceCents)}</PrezzoUnitario><PrezzoTotale>${money(lineNet(l))}</PrezzoTotale><AliquotaIVA>${rate(l.vatRate)}</AliquotaIVA>${l.vatRate === 0 ? tag("Natura", l.vatNature ?? "") : ""}</DettaglioLinee>`,
    )
    .join("");
  const riepilogo = s.rows
    .map(
      (r) =>
        `<DatiRiepilogo><AliquotaIVA>${rate(r.rate)}</AliquotaIVA>${r.rate === 0 ? tag("Natura", r.nature ?? "") : ""}<ImponibileImporto>${money(r.net)}</ImponibileImporto><Imposta>${money(r.vat)}</Imposta>${r.rate > 0 ? "<EsigibilitaIVA>I</EsigibilitaIVA>" : ""}${r.rate === 0 ? tag("RiferimentoNormativo", cut(NATURES[r.nature ?? ""]?.ref ?? "Operazione senza IVA", 100)) : ""}</DatiRiepilogo>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
<FatturaElettronicaHeader>
<DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${esc(vatCode(company.vat) || digits(company.taxCode))}</IdCodice></IdTrasmittente><ProgressivoInvio>${prog}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${code}</CodiceDestinatario>${tag("PECDestinatario", pec)}</DatiTrasmissione>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(vatCode(company.vat))}</IdCodice></IdFiscaleIVA>${tag("CodiceFiscale", digits(company.taxCode) || null)}<Anagrafica><Denominazione>${esc(cut(company.name, 80))}</Denominazione></Anagrafica><RegimeFiscale>${company.taxRegime}</RegimeFiscale></DatiAnagrafici>${sede(company, false)}${
    company.reaOffice && company.reaNumber
      ? `<IscrizioneREA><Ufficio>${esc(company.reaOffice.toUpperCase())}</Ufficio><NumeroREA>${esc(company.reaNumber)}</NumeroREA><StatoLiquidazione>LN</StatoLiquidazione></IscrizioneREA>`
      : ""
  }</CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici>${
    custVat ? `<IdFiscaleIVA><IdPaese>${custCountry}</IdPaese><IdCodice>${esc(custVat)}</IdCodice></IdFiscaleIVA>` : ""
  }${!custForeign ? tag("CodiceFiscale", digits(customer.taxCode) || null) : ""}<Anagrafica><Denominazione>${esc(cut(customer.name, 80))}</Denominazione></Anagrafica></DatiAnagrafici>${sede(customer, custForeign)}</CessionarioCommittente>
</FatturaElettronicaHeader>
<FatturaElettronicaBody>
<DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${inv.docType}</TipoDocumento><Divisa>EUR</Divisa><Data>${inv.date}</Data><Numero>${inv.number}</Numero>${
    stamp ? "<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>" : ""
  }<ImportoTotaleDocumento>${money(s.total)}</ImportoTotaleDocumento>${causali.map((c) => tag("Causale", c)).join("")}</DatiGeneraliDocumento>${
    inv.related ? `<DatiFattureCollegate><IdDocumento>${esc(inv.related.number)}</IdDocumento><Data>${inv.related.date}</Data></DatiFattureCollegate>` : ""
  }</DatiGenerali>
<DatiBeniServizi>${lines}${riepilogo}</DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>${inv.paymentMethod}</ModalitaPagamento>${tag("DataScadenzaPagamento", inv.paymentDue)}<ImportoPagamento>${money(s.total)}</ImportoPagamento>${
    inv.paymentMethod === "MP05" || inv.paymentMethod === "MP19" ? tag("IBAN", iban || null) : ""
  }</DettaglioPagamento></DatiPagamento>
</FatturaElettronicaBody>
</p:FatturaElettronica>
`;
}

// ---------------------------------------------------------------------------
// Lettura fatture ricevute
// ---------------------------------------------------------------------------

/** Dal contenuto ricevuto (XML o .p7m, in base64 o testo) ricava l'XML della fattura */
export function extractXml(payload: string, encoding?: string | null): string | null {
  let bytes: Buffer;
  if (encoding === "Base64" || !/^\s*</.test(payload)) {
    try {
      bytes = Buffer.from(payload.replace(/\s+/g, ""), "base64");
    } catch {
      return null;
    }
  } else bytes = Buffer.from(payload, "utf8");
  // a volte il .p7m è a sua volta in base64
  let text = bytes.toString("latin1");
  if (!text.includes("FatturaElettronica") && /^[A-Za-z0-9+/=\s]+$/.test(text.slice(0, 200))) {
    text = Buffer.from(text.replace(/\s+/g, ""), "base64").toString("latin1");
  }
  const start = text.search(/<\?xml|<([A-Za-z0-9_]+:)?FatturaElettronica[\s>]/);
  const endMatch = /<\/([A-Za-z0-9_]+:)?FatturaElettronica>/.exec(text);
  if (start < 0 || !endMatch) return null;
  let xml = text.slice(start, endMatch.index + endMatch[0].length);
  // nei .p7m lunghi il contenuto è spezzato in blocchi: tolgo le intestazioni dei blocchi
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(xml)) xml = xml.replace(/\x04\x82[\s\S]{2}|\x04\x81[\s\S]/g, "");
  // l'XML è in UTF-8: lo ridecodifico correttamente
  return Buffer.from(xml, "latin1").toString("utf8");
}

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const cents = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Math.round(Number(String(v)) * 100));

export type ParsedInvoice = {
  supplier: { name: string; vat: string | null; taxCode: string | null; address: string };
  customer: { name: string; vat: string | null };
  docType: string;
  number: string;
  date: string;
  total: number;
  net: number;
  vat: number;
  due: string | null;
  iban: string | null;
  causale: string;
  lines: { description: string; quantity: number; unitPrice: number; total: number; vatRate: number; nature: string | null }[];
  summary: { rate: number; nature: string | null; net: number; vat: number }[];
};

function partyName(a: Record<string, unknown> | undefined) {
  const an = (a?.Anagrafica ?? {}) as Record<string, string>;
  return an.Denominazione ?? [an.Nome, an.Cognome].filter(Boolean).join(" ");
}

export function parseInvoiceXml(xml: string): ParsedInvoice | null {
  try {
    const root = parser.parse(xml)?.FatturaElettronica;
    if (!root) return null;
    const h = root.FatturaElettronicaHeader;
    const body = arr(root.FatturaElettronicaBody)[0];
    const ced = h.CedentePrestatore;
    const ces = h.CessionarioCommittente;
    const gen = body.DatiGenerali.DatiGeneraliDocumento;
    const bs = body.DatiBeniServizi;
    const riep = arr(bs.DatiRiepilogo).map((r: Record<string, string>) => ({
      rate: Number(r.AliquotaIVA),
      nature: r.Natura ?? null,
      net: cents(r.ImponibileImporto),
      vat: cents(r.Imposta),
    }));
    const net = riep.reduce((s, r) => s + r.net, 0);
    const vat = riep.reduce((s, r) => s + r.vat, 0);
    const pay = arr(body.DatiPagamento).flatMap((p: Record<string, unknown>) => arr(p.DettaglioPagamento as Record<string, string>[]));
    const sedeC = ced.Sede ?? {};
    return {
      supplier: {
        name: partyName(ced.DatiAnagrafici),
        vat: ced.DatiAnagrafici?.IdFiscaleIVA ? `${ced.DatiAnagrafici.IdFiscaleIVA.IdPaese}${ced.DatiAnagrafici.IdFiscaleIVA.IdCodice}` : null,
        taxCode: ced.DatiAnagrafici?.CodiceFiscale ?? null,
        address: [sedeC.Indirizzo, sedeC.NumeroCivico, sedeC.CAP, sedeC.Comune, sedeC.Provincia && `(${sedeC.Provincia})`].filter(Boolean).join(" "),
      },
      customer: {
        name: partyName(ces.DatiAnagrafici),
        vat: ces.DatiAnagrafici?.IdFiscaleIVA ? `${ces.DatiAnagrafici.IdFiscaleIVA.IdPaese}${ces.DatiAnagrafici.IdFiscaleIVA.IdCodice}` : null,
      },
      docType: gen.TipoDocumento,
      number: String(gen.Numero),
      date: gen.Data,
      total: gen.ImportoTotaleDocumento !== undefined ? cents(gen.ImportoTotaleDocumento) : net + vat,
      net,
      vat,
      due: pay.map((p) => p.DataScadenzaPagamento).filter(Boolean).sort()[0] ?? null,
      iban: pay.map((p) => p.IBAN).find(Boolean) ?? null,
      causale: arr(gen.Causale).join(" "),
      lines: arr(bs.DettaglioLinee).map((l: Record<string, string>) => ({
        description: l.Descrizione ?? "",
        quantity: l.Quantita ? Number(l.Quantita) : 1,
        unitPrice: cents(l.PrezzoUnitario),
        total: cents(l.PrezzoTotale),
        vatRate: Number(l.AliquotaIVA ?? 0),
        nature: l.Natura ?? null,
      })),
      summary: riep,
    };
  } catch {
    return null;
  }
}

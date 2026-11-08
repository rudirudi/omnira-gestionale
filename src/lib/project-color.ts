/**
 * Colore fisso per progetto (stesso progetto = stesso colore ovunque).
 * Tonalità scure e sature: il testo bianco resta sempre leggibile.
 */
const PALETTE = [
  "oklch(0.48 0.17 262)", // blu
  "oklch(0.47 0.19 300)", // viola
  "oklch(0.5 0.12 190)", // petrolio
  "oklch(0.52 0.19 15)", // rosa scuro
  "oklch(0.52 0.15 45)", // arancio bruciato
  "oklch(0.5 0.14 155)", // smeraldo
  "oklch(0.45 0.16 280)", // indaco
  "oklch(0.5 0.2 335)", // fucsia
  "oklch(0.5 0.11 220)", // ottanio
  "oklch(0.5 0.13 75)", // ocra
];

export function projectColor(id: string | null | undefined) {
  if (!id) return "oklch(0.5 0.02 260)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

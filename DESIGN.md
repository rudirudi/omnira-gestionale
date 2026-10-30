# DESIGN.md — Omnira Gestionale

Riferimento unico per l'aspetto del gestionale. Persone e agenti di coding leggono questo file prima di creare o modificare un'interfaccia. I valori vivono come variabili CSS in `src/app/globals.css`: cambiare un colore lì lo cambia ovunque.

> **Stato del brand:** palette provvisoria. Colori e font ufficiali del sito omnirasoft.it vanno confermati e sostituiti in `globals.css` (sezione `:root` e `.dark`).

## Personalità

- Strumento di lavoro quotidiano: sobrio, denso di informazioni ma arioso, veloce.
- Riferimenti: Linear, Vercel Dashboard, Attio. Niente gradienti decorativi, niente ombre pesanti, niente emoji nell'interfaccia.
- Tono dei testi: italiano diretto, seconda persona plurale implicita ("Nuovo cliente", "Salva modifiche"), messaggi d'errore che dicono cosa fare.

## Colori (token)

| Token | Uso | Chiaro | Scuro |
| --- | --- | --- | --- |
| `--background` | Sfondo pagina | quasi bianco caldo | grafite |
| `--card` | Superfici, pannelli | bianco | grafite più chiaro |
| `--foreground` | Testo principale | neutro 950 | neutro 50 |
| `--muted-foreground` | Testo secondario, etichette | neutro 500 | neutro 400 |
| `--primary` | Azione principale, link attivi, focus | blu Omnira | blu Omnira chiaro |
| `--border` | Bordi 1px | neutro 200 | bianco 10% |
| `--success` / `--warning` / `--destructive` | Stati | verde / ambra / rosso | idem, più chiari |

Regole:
- Un solo colore d'accento (`--primary`). Gli stati usano sempre colore **+ etichetta**, mai solo colore.
- Sfondi tinti degli stati al 10–12% di opacità, testo pieno.

## Tipografia

- Font: **Geist Sans** (UI) e **Geist Mono** (codici, importi in tabella, numeri di fattura).
- Scala: 12 (meta) · 13 (tabelle, controlli) · 14 (testo) · 16 (titoli sezione) · 20 (titolo pagina) · 28 (KPI).
- Pesi: 400 testo, 500 controlli ed etichette, 600 titoli. Mai 700+.
- Numeri: `tabular-nums` in tabelle e KPI; euro in formato italiano (`1.234,50 €`), date `gg/mm/aaaa`.

## Spaziature e forme

- Griglia da 4px; padding pagina 24px (desktop) / 16px (mobile).
- Raggio: 6px controlli, 10px card e pannelli, 999px badge.
- Bordi 1px; ombra solo su popover, menu e dialog.
- Altezza controlli: 32px (compatti, tabelle) / 36px (form).

## Layout

- **Sidebar** sinistra 240px, comprimibile a 56px (solo icone). Sezioni: Lavoro (Dashboard, Clienti, Lead, Progetti, Task, Tempo), Amministrazione (Preventivi, Fatture, Canoni), Assistenza (Ticket), Sistema (Report, Impostazioni).
- **Topbar** 56px: titolo/breadcrumb, ricerca globale (Ctrl/⌘ K), "+ Nuovo", notifiche, utente.
- **Pagina lista**: intestazione con titolo, conteggio, filtri e azione primaria a destra; sotto la tabella.
- **Pagina dettaglio**: intestazione con nome, stato e azioni; schede (Panoramica, Progetti, Attività…).
- Mobile: sidebar diventa drawer; tabelle scorrono in orizzontale con la prima colonna fissa.

## Componenti

Basati su shadcn/ui (Radix + Tailwind) in `src/components/ui`. Icone **Lucide** 16px (18px nella sidebar), tratto 1.75. Animazioni con **Motion**: 150–200ms, ease-out, solo su apertura pannelli, drag & drop e conferme.

## Stati vuoti, caricamento, errori

- Stato vuoto: icona, una frase, azione primaria ("Nessun cliente. Aggiungi il primo cliente").
- Caricamento: skeleton della forma reale, mai spinner a pagina intera.
- Errori: toast in basso a destra con azione "Riprova" quando ha senso.

## Accessibilità

- Contrasto WCAG AA, focus visibile (anello `--ring` 2px), tutto usabile da tastiera.
- Etichette su ogni campo; `aria-label` sui pulsanti solo icona.

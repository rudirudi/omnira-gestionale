# DESIGN.md — Omnira Gestionale

Riferimento unico per l'aspetto del gestionale. Persone e agenti di coding leggono questo file prima di creare o modificare un'interfaccia. I valori vivono come variabili CSS in `src/app/globals.css`: cambiare un colore lì lo cambia ovunque.

## Colori

Base **blu istituzionale e bianco**; **rosso, verde e giallo acceso** come colori secondari.

| Token | Uso | Valore (chiaro) |
| --- | --- | --- |
| `--primary` | Blu istituzionale: azioni principali, link, focus, stato "attivo" | ≈ #1F4196 |
| `--background` / `--card` | Bianco: sfondo pagine e superfici | #FFFFFF |
| `--sidebar` | Barra laterale in blu pieno con testo bianco | ≈ #0E2A6B |
| `--destructive` | Rosso: errori, ritardi, urgente, lead perso | ≈ #D62D2D |
| `--success` | Verde: completato, vinto, attivo | ≈ #1F9D55 |
| `--warning` | Giallo acceso: in attesa, in review, scadenze vicine, accento del logo | ≈ #F7D312 (testo scuro sopra) |
| `--muted-foreground` | Testo secondario | grigio-blu |

Regole:
- Il blu domina; rosso, verde e giallo si usano a piccole dosi (badge, icone, indicatori), mai come sfondo di grandi aree.
- Sul giallo il testo è sempre scuro (`--warning-foreground`), mai bianco.
- Gli stati usano sempre colore **+ etichetta**, mai solo colore.
- Il tema scuro usa le stesse tinte, più chiare e meno sature.

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

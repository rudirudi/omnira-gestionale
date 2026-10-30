# Omnira Gestionale

Gestionale interno di Omnira Soft: clienti, lead, progetti, task, tempo, preventivi, fatture e assistenza.
Web app **Next.js 16 + Supabase**, installabile come PWA. Progetto completo e roadmap nel documento "Omnira Gestionale — Progetto della web app".

## Stato

| Modulo | Stato |
| --- | --- |
| M0 Fondamenta (login, ruoli, sedi, impostazioni, registro attività) | ✅ |
| M1 Dashboard | ✅ base (KPI commerciali, scadenze) |
| M2 CRM clienti, referenti, attività, pipeline lead | ✅ |
| M3–M5 Progetti, task, collaborazione | Fase 1 — prossimi |
| M6–M14 | Fasi 2–4 (pagine segnaposto già nel menu) |

## Avvio in locale

1. **Database.** Crea un progetto Supabase in regione UE (es. Frankfurt). Apri *SQL Editor* ed esegui, in ordine, i file in `supabase/migrations/`.
2. **Variabili.** Copia `.env.example` in `.env.local` e inserisci URL e chiave pubblica (*Project Settings → API*).
3. **Avvio.**
   ```bash
   npm install
   npm run dev
   ```
4. **Primo accesso.** Crea il tuo utente da Supabase (*Authentication → Users → Add user*). **Il primo utente diventa automaticamente amministratore**; gli altri entrano come "Team" e l'admin assegna i ruoli da *Impostazioni → Team*.

Accesso con Google (opzionale): abilita il provider Google in *Authentication → Providers* e aggiungi `https://<dominio>/auth/callback` agli URL di redirect.

## Ruoli

| Ruolo | Può |
| --- | --- |
| Amministratore | Tutto, inclusi ruoli del team, archiviazione, registro attività |
| Project manager | Clienti, referenti, lead |
| Commerciale | Clienti, referenti, lead |
| Amministrazione | Clienti, referenti, dati aziendali |
| Team | Legge tutto, registra attività e note |

I permessi sono applicati nel database con **Row Level Security** (`supabase/migrations`); la UI si limita a nascondere ciò che non si può fare.

## Struttura

```
src/
  app/                 Rotte (App Router). (app)/ = area autenticata
  components/ui/       Componenti base (stile shadcn/ui, Radix)
  components/app/      Componenti condivisi (header pagina, form, stati vuoti)
  components/layout/   Sidebar, topbar, palette comandi (Ctrl/⌘ K)
  modules/<modulo>/    Un modulo = queries.ts (lettura), actions.ts (Server Actions), schema.ts (Zod), components/
  lib/                 Supabase, auth, permessi, etichette, tipi DB
supabase/
  migrations/          Schema SQL versionato
  tests/               Test RLS e dati demo per Postgres locale
DESIGN.md              Regole visive (colori, tipografia, componenti)
```

Convenzioni: importi in **centesimi** (intero), date con fuso orario, cancellazione logica (`deleted_at`), ogni Server Action riverifica sessione e ruolo.

## Test

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Test delle policy RLS su un Postgres 16 locale (senza Supabase):

```bash
createdb omnira_test
psql -d omnira_test -f supabase/tests/auth_stub.sql
psql -d omnira_test -f supabase/migrations/20261030000001_fondamenta_crm.sql
psql -d omnira_test -f supabase/tests/rls_test.sql   # stampa "OK: ..." per ogni controllo
```

## Da completare

- **Colori del brand**: la palette in `src/app/globals.css` è provvisoria; sostituirla con i colori ufficiali Omnira (vedi `DESIGN.md`).
- **Tipi del database**: dopo aver collegato Supabase, rigenerare `src/lib/database.types.ts` con `npx supabase gen types typescript`.

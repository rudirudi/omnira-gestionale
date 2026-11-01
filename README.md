# Omnira Gestionale

Gestionale interno di Omnira Soft: clienti, lead, progetti, task, tempo, preventivi, fatture e assistenza.
Web app **Next.js 16 + Supabase**, installabile come PWA. Progetto completo e roadmap nel documento "Omnira Gestionale — Progetto della web app".

## Stato

| Modulo | Stato |
| --- | --- |
| M0 Fondamenta (login, ruoli, sedi, impostazioni, registro attività) | ✅ |
| M1 Dashboard | ✅ base (KPI commerciali, scadenze) |
| M2 CRM clienti, referenti, attività, pipeline lead | ✅ |
| M3 Progetti (template per tipo, fasi, milestone, team, budget) | ✅ |
| M4 Task (board, lista, calendario, sotto-task, assegnatari, priorità) | ✅ |
| M5 Commenti con @menzioni, notifiche in tempo reale | ✅ |
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


## Accesso, registrazioni ed email (configurazione Supabase)

**Authentication → URL Configuration**
- Site URL: `https://omnira-gestionale.vercel.app`
- Redirect URLs: `https://omnira-gestionale.vercel.app/auth/callback` e `https://omnira-gestionale.vercel.app/auth/confirm`

**Authentication → Sign In / Providers**
- "Allow new users to sign up": attivo. Chi si registra resta **in attesa** finché un admin non lo attiva (Impostazioni → Team); gli admin ricevono una notifica.
- "Confirm email": attivo (consigliato).
- Google: vedi sotto.

**Authentication → Emails → Templates** — sostituire il link in ogni template, così i link funzionano da qualsiasi browser o telefono:

| Template | Link da usare |
| --- | --- |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Magic link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

**Accesso con Google**
1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → tipo "Web application".
2. Authorized redirect URI: `https://ppkhewqtokvjaoynxurh.supabase.co/auth/v1/callback`.
3. Copiare Client ID e Client secret in Supabase → Authentication → Providers → Google → Enable.

## Ruoli

| Ruolo | Può |
| --- | --- |
| Amministratore | Tutto, inclusi ruoli del team, archiviazione, registro attività |
| Project manager | Progetti, fasi, milestone, team di progetto, clienti, lead |
| Commerciale | Clienti, referenti, lead |
| Amministrazione | Clienti, referenti, dati aziendali |
| Team | Legge tutto; crea e aggiorna task, commenta, registra attività |

Nota: il primo utente registrato diventa amministratore; tutti gli altri entrano **disattivati** finché un admin non li attiva.

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

- **Tipi del database**: dopo aver collegato Supabase, rigenerare `src/lib/database.types.ts` con `npx supabase gen types typescript`.

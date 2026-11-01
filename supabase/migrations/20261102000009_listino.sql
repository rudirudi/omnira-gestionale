-- =============================================================================
-- Migrazione 9: Listino servizi (prezzi standard da usare nei preventivi)
-- =============================================================================

create type public.service_category as enum (
  'sito', 'ecommerce', 'software', 'gestionale', 'app', 'automazione_ai', 'seo',
  'grafica', 'hosting', 'assistenza', 'altro'
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,                              -- finisce nei "dettagli" della voce del preventivo
  category public.service_category not null default 'altro',
  unit text not null default 'pz',
  price_cents integer check (price_cents is null or price_cents >= 0), -- null = da definire
  frequency public.renewal_frequency,            -- null = una tantum; altrimenti canone
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index services_category_idx on public.services (category, position) where deleted_at is null;
create index services_created_by_idx on public.services (created_by);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger services_audit after insert or update or delete on public.services
  for each row execute function public.audit_row();

alter table public.services enable row level security;
create policy services_select on public.services for select to authenticated using ((select public.can_view_money()));
create policy services_insert on public.services for insert to authenticated with check ((select public.can_view_money()));
create policy services_update on public.services for update to authenticated
  using ((select public.can_view_money())) with check ((select public.can_view_money()));
create policy services_delete on public.services for delete to authenticated using ((select public.has_role(array['admin']::public.app_role[])));

-- Voci di partenza senza prezzo: i prezzi standard li inserisce Omnira
insert into public.services (category, name, description, unit, frequency, position) values
  ('sito', 'Sito vetrina', 'Progettazione e sviluppo sito responsive fino a 5 pagine, modulo contatti, SEO di base, privacy e cookie.', 'pz', null, 1),
  ('sito', 'Pagina aggiuntiva', 'Pagina extra con contenuti forniti dal cliente.', 'pagine', null, 2),
  ('sito', 'Landing page', 'Pagina singola per campagne, con modulo di contatto e tracciamento conversioni.', 'pz', null, 3),
  ('ecommerce', 'E-commerce', 'Negozio online con catalogo, carrello, pagamenti, spedizioni e area clienti.', 'pz', null, 1),
  ('ecommerce', 'Caricamento prodotti', 'Inserimento prodotti con foto, descrizioni e varianti.', 'pz', null, 2),
  ('gestionale', 'Gestionale su misura', 'Analisi, progettazione e sviluppo di un gestionale web con utenti e permessi.', 'pz', null, 1),
  ('software', 'Sviluppo software', 'Sviluppo a giornata di funzionalità su misura.', 'giorni', null, 1),
  ('software', 'Analisi e progettazione', 'Raccolta requisiti, flussi, prototipo e piano di lavoro.', 'giorni', null, 2),
  ('app', 'App mobile', 'App iOS e Android con pubblicazione sugli store.', 'pz', null, 1),
  ('automazione_ai', 'Chatbot AI', 'Assistente virtuale per sito o WhatsApp addestrato sui contenuti del cliente.', 'pz', null, 1),
  ('automazione_ai', 'Automazione processi', 'Automazione di un flusso (documenti, email, dati) con integrazione AI.', 'pz', null, 2),
  ('seo', 'SEO mensile', 'Ottimizzazione continua, contenuti e report mensile di posizionamento.', 'mesi', 'mensile', 1),
  ('grafica', 'Logo e identità visiva', 'Logo, palette colori, font e linee guida di base.', 'pz', null, 1),
  ('hosting', 'Hosting e manutenzione', 'Hosting, backup giornalieri, aggiornamenti e certificato SSL.', 'anno', 'annuale', 1),
  ('hosting', 'Dominio', 'Registrazione e rinnovo del dominio.', 'anno', 'annuale', 2),
  ('hosting', 'Caselle email', 'Caselle email professionali sul dominio del cliente.', 'anno', 'annuale', 3),
  ('assistenza', 'Assistenza a ore', 'Interventi, modifiche e supporto su richiesta.', 'ore', null, 1),
  ('assistenza', 'Formazione', 'Formazione all''uso del sito o del gestionale.', 'ore', null, 2);

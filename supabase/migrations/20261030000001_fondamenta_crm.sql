-- =============================================================================
-- Omnira Gestionale — Migrazione 1: Fondamenta (M0) e CRM (M2)
-- Profili, ruoli, sedi, impostazioni azienda, registro attività,
-- clienti, referenti, lead, attività commerciali. RLS su tutte le tabelle.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'admin', 'project_manager', 'team', 'amministrazione', 'commerciale'
);
create type public.client_status as enum ('prospect', 'attivo', 'inattivo');
create type public.lead_stage as enum ('nuovo', 'call', 'analisi', 'preventivo', 'vinto', 'perso');
create type public.lead_source as enum ('sito', 'form', 'chatbot', 'whatsapp', 'referral', 'social', 'evento', 'altro');
create type public.activity_type as enum ('nota', 'chiamata', 'email', 'riunione', 'promemoria');

-- ---------------------------------------------------------------------------
-- Funzioni di utilità
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Sedi
-- ---------------------------------------------------------------------------
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profili (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.app_role not null default 'team',
  site_id uuid references public.sites (id) on delete set null,
  job_title text,
  hourly_cost_cents integer check (hourly_cost_cents is null or hourly_cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Funzioni di autorizzazione (security definer: leggono profiles senza ricorsione RLS)
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = any (roles), false)
$$;

-- Nuovo utente in auth.users → profilo. Il primo utente in assoluto diventa admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when first_user then 'admin'::public.app_role else 'team'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un utente non admin non può cambiarsi ruolo, stato o costo orario.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nullo = SQL editor / service role: modifiche amministrative consentite
  if auth.uid() is not null and not public.has_role(array['admin']::public.app_role[]) then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.hourly_cost_cents is distinct from old.hourly_cost_cents
       or new.email is distinct from old.email then
      raise exception 'Solo un amministratore può modificare ruolo, stato, email o costo orario';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Impostazioni azienda (riga unica)
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  legal_name text not null default 'Omnira Soft',
  vat_number text,
  tax_code text,
  sdi_code text,
  pec text,
  email text default 'info@omnirasoft.it',
  phone text,
  address text,
  iban text,
  invoice_prefix text not null default 'FT',
  default_vat_rate numeric(5,2) not null default 22.00,
  updated_at timestamptz not null default now()
);
create trigger company_settings_updated_at before update on public.company_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Registro attività (audit)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid default auth.uid(),
  changes jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  diff jsonb;
begin
  if tg_op = 'INSERT' then
    diff := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into diff
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
    if diff is null then return new; end if;
  else
    diff := to_jsonb(old);
  end if;
  insert into public.audit_log (table_name, record_id, action, changes)
  values (tg_table_name, coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null), lower(tg_op), diff);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------------
-- Clienti
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  vat_number text,
  tax_code text,
  sdi_code text,
  pec text,
  email text,
  phone text,
  website text,
  address text,
  city text,
  province text,
  zip text,
  country text not null default 'IT',
  sector text,
  status public.client_status not null default 'attivo',
  owner_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index clients_name_idx on public.clients (lower(name)) where deleted_at is null;
create unique index clients_vat_unique on public.clients (vat_number) where vat_number is not null and deleted_at is null;
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Referenti
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  first_name text not null,
  last_name text,
  job_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_client_idx on public.contacts (client_id);
create unique index contacts_one_primary on public.contacts (client_id) where is_primary;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Lead (pipeline commerciale)
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  company_name text,
  contact_name text,
  email text,
  phone text,
  source public.lead_source not null default 'sito',
  stage public.lead_stage not null default 'nuovo',
  service_interest text,
  estimated_value_cents integer check (estimated_value_cents is null or estimated_value_cents >= 0),
  expected_close_date date,
  position double precision not null default 0,
  lost_reason text,
  owner_id uuid references public.profiles (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz,
  constraint leads_lost_reason check (stage <> 'perso' or lost_reason is not null)
);
create index leads_stage_idx on public.leads (stage, position) where deleted_at is null;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger leads_audit after insert or update or delete on public.leads
  for each row execute function public.audit_row();

create or replace function public.leads_set_closed_at()
returns trigger language plpgsql as $$
begin
  if new.stage in ('vinto', 'perso') and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    new.closed_at := now();
  elsif new.stage not in ('vinto', 'perso') then
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger leads_closed_at before insert or update of stage on public.leads
  for each row execute function public.leads_set_closed_at();

-- ---------------------------------------------------------------------------
-- Attività (note, chiamate, email, riunioni, promemoria)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  type public.activity_type not null default 'nota',
  subject text not null,
  body text,
  due_at timestamptz,
  done_at timestamptz,
  client_id uuid references public.clients (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint activities_target check (client_id is not null or lead_id is not null)
);
create index activities_client_idx on public.activities (client_id, created_at desc);
create index activities_lead_idx on public.activities (lead_id, created_at desc);
create index activities_due_idx on public.activities (due_at) where done_at is null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;

-- Sedi: tutti i membri attivi leggono; solo admin scrive
create policy sites_select on public.sites for select to authenticated using (public.is_staff());
create policy sites_write on public.sites for all to authenticated
  using (public.has_role(array['admin']::public.app_role[]))
  with check (public.has_role(array['admin']::public.app_role[]));

-- Profili: lettura per il team; modifica del proprio profilo o da admin
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_staff() or id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(array['admin']::public.app_role[]))
  with check (id = auth.uid() or public.has_role(array['admin']::public.app_role[]));

-- Impostazioni azienda: lettura team; modifica admin e amministrazione
create policy settings_select on public.company_settings for select to authenticated using (public.is_staff());
create policy settings_update on public.company_settings for update to authenticated
  using (public.has_role(array['admin', 'amministrazione']::public.app_role[]))
  with check (public.has_role(array['admin', 'amministrazione']::public.app_role[]));

-- Audit: solo admin legge; si scrive solo tramite trigger
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- CRM: tutto il team legge; scrivono admin, PM, commerciale, amministrazione
create policy clients_select on public.clients for select to authenticated using (public.is_staff());
create policy clients_insert on public.clients for insert to authenticated
  with check (public.has_role(array['admin', 'project_manager', 'commerciale', 'amministrazione']::public.app_role[]));
create policy clients_update on public.clients for update to authenticated
  using (public.has_role(array['admin', 'project_manager', 'commerciale', 'amministrazione']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager', 'commerciale', 'amministrazione']::public.app_role[]));
create policy clients_delete on public.clients for delete to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

create policy contacts_select on public.contacts for select to authenticated using (public.is_staff());
create policy contacts_write on public.contacts for all to authenticated
  using (public.has_role(array['admin', 'project_manager', 'commerciale', 'amministrazione']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager', 'commerciale', 'amministrazione']::public.app_role[]));

create policy leads_select on public.leads for select to authenticated using (public.is_staff());
create policy leads_insert on public.leads for insert to authenticated
  with check (public.has_role(array['admin', 'project_manager', 'commerciale']::public.app_role[]));
create policy leads_update on public.leads for update to authenticated
  using (public.has_role(array['admin', 'project_manager', 'commerciale']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager', 'commerciale']::public.app_role[]));
create policy leads_delete on public.leads for delete to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- Attività: tutto il team legge e aggiunge; modifica/cancella l'autore o un admin
create policy activities_select on public.activities for select to authenticated using (public.is_staff());
create policy activities_insert on public.activities for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
create policy activities_update on public.activities for update to authenticated
  using (created_by = auth.uid() or public.has_role(array['admin']::public.app_role[]))
  with check (created_by = auth.uid() or public.has_role(array['admin']::public.app_role[]));
create policy activities_delete on public.activities for delete to authenticated
  using (created_by = auth.uid() or public.has_role(array['admin']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- Dati iniziali
-- ---------------------------------------------------------------------------
insert into public.sites (name, address) values
  ('Terni', 'Via Maestri del Lavoro 28B, 05100 Terni (TR)'),
  ('Longobucco', 'Via C. Colombo 102, 87066 Longobucco (CS)');

insert into public.company_settings (id) values (1);

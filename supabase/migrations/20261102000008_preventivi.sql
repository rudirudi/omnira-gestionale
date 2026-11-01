-- =============================================================================
-- Migrazione 8: Preventivi
-- Un preventivo nasce da un lead o da un cliente. Quando viene accettato
-- diventa progetto + importi da incassare (acconto/saldo) + scadenze ricorrenti.
-- =============================================================================

create type public.quote_status as enum ('bozza', 'inviato', 'accettato', 'rifiutato');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text unique,                          -- PRV-2026-001
  title text not null check (length(trim(title)) > 0),
  client_id uuid references public.clients (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  status public.quote_status not null default 'bozza',
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  intro text,                                  -- premessa / descrizione della proposta
  terms text,                                  -- tempi, modalità, condizioni
  vat_rate numeric(5,2) not null default 22.00 check (vat_rate between 0 and 100),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  deposit_pct smallint not null default 30 check (deposit_pct between 0 and 100),
  owner_id uuid default auth.uid() references public.profiles (id) on delete set null,
  sent_at timestamptz,
  decided_at timestamptz,
  refused_reason text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quotes_recipient check (client_id is not null or lead_id is not null),
  constraint quotes_validity check (valid_until >= issue_date)
);
create index quotes_status_idx on public.quotes (status) where deleted_at is null;
create index quotes_client_idx on public.quotes (client_id);
create index quotes_lead_idx on public.quotes (lead_id);
create index quotes_project_idx on public.quotes (project_id);
create index quotes_owner_idx on public.quotes (owner_id);
create index quotes_created_by_idx on public.quotes (created_by);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger quotes_audit after insert or update or delete on public.quotes
  for each row execute function public.audit_row();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  position integer not null default 0,
  description text not null check (length(trim(description)) > 0),
  details text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text not null default 'pz',
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  frequency public.renewal_frequency,          -- null = una tantum; altrimenti canone ricorrente
  created_at timestamptz not null default now()
);
create index quote_items_quote_idx on public.quote_items (quote_id, position);

-- Numerazione progressiva per anno: PRV-2026-001
create or replace function public.quotes_before_insert()
returns trigger language plpgsql set search_path = public as $$
declare
  yr text := to_char(coalesce(new.issue_date, current_date), 'YYYY');
  nxt int;
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('quote_number_' || yr));
    select coalesce(max(substring(number from 'PRV-\d{4}-(\d+)')::int), 0) + 1 into nxt
    from public.quotes where number like 'PRV-' || yr || '-%';
    new.number := 'PRV-' || yr || '-' || lpad(nxt::text, 3, '0');
  end if;
  return new;
end $$;
revoke execute on function public.quotes_before_insert() from public, anon, authenticated;
create trigger quotes_before_insert before insert on public.quotes
  for each row execute function public.quotes_before_insert();

-- ---------------------------------------------------------------------------
-- Accettazione: crea progetto, importi da incassare e scadenze ricorrenti.
-- SECURITY INVOKER: valgono i permessi di chi accetta (RLS su progetti e incassi).
-- ---------------------------------------------------------------------------
create or replace function public.accept_quote(
  p_id uuid,
  p_create_project boolean default true,
  p_project_type public.project_type default 'altro',
  p_create_receivables boolean default true,
  p_create_renewals boolean default true
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  q public.quotes;
  it record;
  net_one_off bigint;
  gross bigint;
  deposit bigint;
  proj uuid;
begin
  select * into q from public.quotes where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Preventivo non trovato'; end if;
  if q.status in ('accettato', 'rifiutato') then raise exception 'Il preventivo è già %', q.status; end if;
  if q.client_id is null then raise exception 'Collega prima un cliente al preventivo'; end if;

  select coalesce(sum(round(quantity * unit_price_cents)), 0) into net_one_off
  from public.quote_items where quote_id = p_id and frequency is null;
  net_one_off := greatest(0, net_one_off - q.discount_cents);
  gross := round(net_one_off * (1 + q.vat_rate / 100));

  proj := q.project_id;
  if p_create_project and proj is null then
    insert into public.projects (name, client_id, lead_id, type, status, billing_type, budget_cents, description)
    values (q.title, q.client_id, q.lead_id, p_project_type, 'pianificato', 'corpo', net_one_off,
            'Da preventivo ' || q.number || coalesce(E'\n\n' || q.intro, ''))
    returning id into proj;
  end if;

  if p_create_receivables and gross > 0 then
    deposit := round(gross * q.deposit_pct / 100.0);
    if deposit > 0 and deposit < gross then
      insert into public.receivables (client_id, project_id, description, amount_cents, due_date, notes)
      values (q.client_id, proj, 'Acconto ' || q.deposit_pct || '% – ' || q.title, deposit, current_date, 'Preventivo ' || q.number),
             (q.client_id, proj, 'Saldo – ' || q.title, gross - deposit, null, 'Preventivo ' || q.number);
    else
      insert into public.receivables (client_id, project_id, description, amount_cents, due_date, notes)
      values (q.client_id, proj, q.title, gross, current_date, 'Preventivo ' || q.number);
    end if;
  end if;

  if p_create_renewals then
    for it in select * from public.quote_items where quote_id = p_id and frequency is not null order by position loop
      insert into public.renewals (client_id, project_id, type, name, frequency, next_due_date, price_cents, notes)
      values (q.client_id, proj, 'manutenzione', it.description, it.frequency,
              (current_date + public.frequency_interval(it.frequency))::date,
              round(it.quantity * it.unit_price_cents * (1 + q.vat_rate / 100)),
              'Da preventivo ' || q.number);
    end loop;
  end if;

  update public.quotes set status = 'accettato', decided_at = now(), project_id = proj where id = p_id;
  if q.lead_id is not null then
    update public.leads set stage = 'vinto', client_id = coalesce(client_id, q.client_id) where id = q.lead_id and stage <> 'vinto';
  end if;
  return proj;
end $$;
revoke execute on function public.accept_quote(uuid, boolean, public.project_type, boolean, boolean) from public, anon;
grant execute on function public.accept_quote(uuid, boolean, public.project_type, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: chi segue vendite e conti (admin, amministrazione, PM, commerciale)
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy quotes_select on public.quotes for select to authenticated using ((select public.can_view_money()));
create policy quotes_insert on public.quotes for insert to authenticated with check ((select public.can_view_money()));
create policy quotes_update on public.quotes for update to authenticated
  using ((select public.can_view_money())) with check ((select public.can_view_money()));
create policy quotes_delete on public.quotes for delete to authenticated using ((select public.has_role(array['admin']::public.app_role[])));

create policy quote_items_select on public.quote_items for select to authenticated using ((select public.can_view_money()));
create policy quote_items_insert on public.quote_items for insert to authenticated with check ((select public.can_view_money()));
create policy quote_items_update on public.quote_items for update to authenticated
  using ((select public.can_view_money())) with check ((select public.can_view_money()));
create policy quote_items_delete on public.quote_items for delete to authenticated using ((select public.can_view_money()));

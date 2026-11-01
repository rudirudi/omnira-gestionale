-- =============================================================================
-- Migrazione 7: Spese (una tantum) e Abbonamenti (spese ricorrenti che si
-- cumulano da sole: ogni addebito diventa una riga di spesa)
-- =============================================================================

create type public.expense_category as enum (
  'software', 'hosting', 'domini', 'hardware', 'collaboratori', 'marketing',
  'trasferte', 'formazione', 'ufficio', 'telefonia', 'tasse', 'banca', 'altro'
);
create type public.expense_paid_with as enum ('azienda', 'personale');

-- Intervallo di una frequenza (riusata da abbonamenti e scadenze)
create or replace function public.frequency_interval(f public.renewal_frequency)
returns interval language sql immutable set search_path = public as $$
  select case f
    when 'mensile' then interval '1 month'
    when 'trimestrale' then interval '3 months'
    when 'semestrale' then interval '6 months'
    when 'annuale' then interval '1 year'
    else interval '2 years' end
$$;

-- ---------------------------------------------------------------------------
-- Abbonamenti: Claude, Lovable, Google Workspace, Adobe…
-- ---------------------------------------------------------------------------
create table public.expense_subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  supplier text,
  category public.expense_category not null default 'software',
  amount_cents integer not null check (amount_cents > 0),
  frequency public.renewal_frequency not null default 'mensile',
  start_date date not null default current_date,  -- primo addebito
  end_date date,                                   -- disdetto: nessun addebito dopo questa data
  charges_count integer not null default 0,        -- addebiti già registrati come spesa
  next_charge_date date not null default current_date,
  paid_by uuid default auth.uid() references public.profiles (id) on delete set null,
  paid_with public.expense_paid_with not null default 'azienda',
  method public.payment_method not null default 'carta',
  active boolean not null default true,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or end_date >= start_date)
);
create index expense_subscriptions_next_idx on public.expense_subscriptions (next_charge_date) where active and deleted_at is null;
create index expense_subscriptions_paid_by_idx on public.expense_subscriptions (paid_by);
create index expense_subscriptions_created_by_idx on public.expense_subscriptions (created_by);
create trigger expense_subscriptions_updated_at before update on public.expense_subscriptions
  for each row execute function public.set_updated_at();
create trigger expense_subscriptions_audit after insert or update or delete on public.expense_subscriptions
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Spese
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  description text not null check (length(trim(description)) > 0),
  amount_cents integer not null check (amount_cents > 0),
  category public.expense_category not null default 'altro',
  supplier text,
  paid_by uuid default auth.uid() references public.profiles (id) on delete set null, -- chi ha sostenuto la spesa
  paid_with public.expense_paid_with not null default 'azienda',  -- carta aziendale o di tasca propria
  method public.payment_method not null default 'carta',
  reimbursed_on date,  -- solo per spese personali: quando sono state rimborsate
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  subscription_id uuid references public.expense_subscriptions (id) on delete set null,
  renewal_id uuid references public.renewals (id) on delete set null,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index expenses_spent_on_idx on public.expenses (spent_on desc) where deleted_at is null;
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expenses_project_idx on public.expenses (project_id) where deleted_at is null;
create index expenses_client_idx on public.expenses (client_id);
create index expenses_subscription_idx on public.expenses (subscription_id);
create index expenses_renewal_idx on public.expenses (renewal_id);
create index expenses_created_by_idx on public.expenses (created_by);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Cumulo automatico: per ogni abbonamento attivo registra una spesa per ogni
-- addebito arrivato (anche quelli passati, se l'abbonamento parte da mesi fa).
-- Le date si calcolano dalla data di inizio, così il 31 del mese non "scivola".
-- ---------------------------------------------------------------------------
create or replace function public.generate_subscription_expenses(p_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s public.expense_subscriptions;
  d date;
  k integer;
  n integer := 0;
begin
  for s in
    select * from public.expense_subscriptions
    where active and deleted_at is null and next_charge_date <= current_date
      and (p_id is null or id = p_id)
    for update
  loop
    k := s.charges_count;
    d := (s.start_date + k * public.frequency_interval(s.frequency))::date;
    while d <= current_date and (s.end_date is null or d <= s.end_date) and k - s.charges_count < 240 loop
      insert into public.expenses (spent_on, description, amount_cents, category, supplier, paid_by, paid_with, method, subscription_id, created_by)
      values (d, s.name, s.amount_cents, s.category, s.supplier, s.paid_by, s.paid_with, s.method, s.id, s.created_by);
      n := n + 1;
      k := k + 1;
      d := (s.start_date + k * public.frequency_interval(s.frequency))::date;
    end loop;
    update public.expense_subscriptions
      set charges_count = k,
          next_charge_date = d,
          active = (s.end_date is null or d <= s.end_date)
      where id = s.id;
  end loop;
  return n;
end $$;
revoke execute on function public.generate_subscription_expenses(uuid) from public, anon, authenticated;

-- Appena inserito, un abbonamento registra subito gli addebiti già maturati
create or replace function public.expense_subscriptions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.generate_subscription_expenses(new.id);
  return null;
end $$;
revoke execute on function public.expense_subscriptions_after_insert() from public, anon, authenticated;
create trigger expense_subscriptions_generate after insert on public.expense_subscriptions
  for each row when (pg_trigger_depth() = 0) execute function public.expense_subscriptions_after_insert();

-- Prima del primo addebito la data del prossimo è la data di inizio
create or replace function public.expense_subscriptions_set_next()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.charges_count := 0;
    new.next_charge_date := new.start_date;
  elsif new.start_date is distinct from old.start_date and old.charges_count = 0 then
    new.next_charge_date := new.start_date;
  end if;
  return new;
end $$;
revoke execute on function public.expense_subscriptions_set_next() from public, anon, authenticated;
create trigger expense_subscriptions_set_next before insert or update on public.expense_subscriptions
  for each row execute function public.expense_subscriptions_set_next();

-- ---------------------------------------------------------------------------
-- Rinnovo scadenza: ora registra anche il costo (quanto paghiamo noi) come spesa
-- ---------------------------------------------------------------------------
drop function if exists public.renew_renewal(uuid, boolean);
create or replace function public.renew_renewal(p_id uuid, p_create_receivable boolean default true, p_create_expense boolean default true)
returns date language plpgsql security invoker set search_path = public as $$
declare
  r public.renewals;
  new_due date;
begin
  select * into r from public.renewals where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Scadenza non trovata'; end if;
  new_due := (r.next_due_date + public.frequency_interval(r.frequency))::date;

  if p_create_receivable and r.client_id is not null and coalesce(r.price_cents, 0) > 0 then
    insert into public.receivables (client_id, project_id, renewal_id, description, amount_cents, due_date)
    values (r.client_id, r.project_id, r.id,
            'Rinnovo ' || r.type::text || ' ' || r.name || ' (' || to_char(r.next_due_date, 'DD/MM/YYYY') || ' → ' || to_char(new_due, 'DD/MM/YYYY') || ')',
            r.price_cents, r.next_due_date);
  end if;

  if p_create_expense and coalesce(r.cost_cents, 0) > 0 then
    insert into public.expenses (spent_on, description, amount_cents, category, supplier, client_id, project_id, renewal_id)
    values (current_date, 'Rinnovo ' || r.type::text || ' ' || r.name, r.cost_cents,
            case r.type
              when 'dominio' then 'domini'
              when 'hosting' then 'hosting' when 'server' then 'hosting' when 'ssl' then 'hosting' when 'email' then 'hosting'
              when 'licenza' then 'software' when 'saas' then 'software'
              else 'altro' end::public.expense_category,
            r.provider, r.client_id, r.project_id, r.id);
  end if;

  update public.renewals set next_due_date = new_due where id = p_id;
  return new_due;
end $$;
revoke execute on function public.renew_renewal(uuid, boolean, boolean) from public, anon;
grant execute on function public.renew_renewal(uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: admin, amministrazione e PM vedono e gestiscono tutte le spese;
-- gli altri vedono e registrano solo le proprie (finché non sono rimborsate).
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.expense_subscriptions enable row level security;

create policy expenses_select on public.expenses for select to authenticated
  using ((select public.can_manage_money()) or paid_by = (select auth.uid()) or created_by = (select auth.uid()));
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select public.can_manage_money()) or (paid_by = (select auth.uid()) and reimbursed_on is null));
create policy expenses_update on public.expenses for update to authenticated
  using ((select public.can_manage_money()) or (paid_by = (select auth.uid()) and reimbursed_on is null))
  with check ((select public.can_manage_money()) or (paid_by = (select auth.uid()) and reimbursed_on is null));
create policy expenses_delete on public.expenses for delete to authenticated
  using ((select public.has_role(array['admin']::public.app_role[])));

create policy expense_subscriptions_select on public.expense_subscriptions for select to authenticated
  using ((select public.can_manage_money()) or paid_by = (select auth.uid()) or created_by = (select auth.uid()));
create policy expense_subscriptions_insert on public.expense_subscriptions for insert to authenticated
  with check ((select public.can_manage_money()) or paid_by = (select auth.uid()));
create policy expense_subscriptions_update on public.expense_subscriptions for update to authenticated
  using ((select public.can_manage_money()) or paid_by = (select auth.uid()))
  with check ((select public.can_manage_money()) or paid_by = (select auth.uid()));
create policy expense_subscriptions_delete on public.expense_subscriptions for delete to authenticated
  using ((select public.has_role(array['admin']::public.app_role[])));

-- ---------------------------------------------------------------------------
-- Ogni mattina registra gli addebiti del giorno (06:00 UTC)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('omnira-addebiti-abbonamenti', '0 6 * * *', 'select public.generate_subscription_expenses()');
  end if;
end $$;

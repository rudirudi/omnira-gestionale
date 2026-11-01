-- =============================================================================
-- Migrazione 6: Incassi (importi dovuti + pagamenti) e Scadenze ricorrenti
-- =============================================================================

create type public.payment_method as enum ('bonifico', 'carta', 'contanti', 'paypal', 'stripe', 'riba', 'altro');
create type public.renewal_type as enum ('dominio', 'hosting', 'server', 'ssl', 'email', 'licenza', 'saas', 'manutenzione', 'altro');
create type public.renewal_frequency as enum ('mensile', 'trimestrale', 'semestrale', 'annuale', 'biennale');

-- Ruoli che gestiscono i soldi
create or replace function public.can_manage_money()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin', 'amministrazione', 'project_manager']::public.app_role[])
$$;
create or replace function public.can_view_money()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin', 'amministrazione', 'project_manager', 'commerciale']::public.app_role[])
$$;
revoke execute on function public.can_manage_money(), public.can_view_money() from public, anon;
grant execute on function public.can_manage_money(), public.can_view_money() to authenticated;

-- ---------------------------------------------------------------------------
-- Scadenze ricorrenti: domini, hosting, server, licenze, SaaS…
-- ---------------------------------------------------------------------------
create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null, -- null = servizio interno Omnira
  project_id uuid references public.projects (id) on delete set null,
  type public.renewal_type not null default 'dominio',
  name text not null check (length(trim(name)) > 0),               -- es. "bottegarossi.it"
  provider text,                                                    -- es. Aruba, Hetzner, AWS
  frequency public.renewal_frequency not null default 'annuale',
  next_due_date date not null,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),   -- quanto paghiamo noi
  price_cents integer check (price_cents is null or price_cents >= 0), -- quanto paga il cliente
  auto_renew boolean not null default false,
  notify_days_before integer not null default 30 check (notify_days_before between 1 and 365),
  notified_for date,          -- scadenza per cui è già partito il preavviso
  notified_expired_for date,  -- scadenza per cui è già partito l'avviso "scaduto"
  active boolean not null default true,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index renewals_due_idx on public.renewals (next_due_date) where deleted_at is null and active;
create index renewals_client_idx on public.renewals (client_id);
create index renewals_project_idx on public.renewals (project_id);
create index renewals_created_by_idx on public.renewals (created_by);
create trigger renewals_updated_at before update on public.renewals
  for each row execute function public.set_updated_at();
create trigger renewals_audit after insert or update or delete on public.renewals
  for each row execute function public.audit_row();

-- Spostando la data di scadenza si azzerano gli avvisi già inviati
create or replace function public.renewals_reset_notified()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.next_due_date is distinct from old.next_due_date then
    new.notified_for := null;
    new.notified_expired_for := null;
  end if;
  return new;
end $$;
create trigger renewals_reset_notified before update of next_due_date on public.renewals
  for each row execute function public.renewals_reset_notified();

-- ---------------------------------------------------------------------------
-- Importi da incassare (una rata, un progetto intero, un rinnovo…)
-- ---------------------------------------------------------------------------
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  renewal_id uuid references public.renewals (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  amount_cents integer not null check (amount_cents > 0),
  due_date date,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index receivables_client_idx on public.receivables (client_id) where deleted_at is null;
create index receivables_project_idx on public.receivables (project_id) where deleted_at is null;
create index receivables_renewal_idx on public.receivables (renewal_id);
create index receivables_due_idx on public.receivables (due_date) where deleted_at is null;
create index receivables_created_by_idx on public.receivables (created_by);
create trigger receivables_updated_at before update on public.receivables
  for each row execute function public.set_updated_at();
create trigger receivables_audit after insert or update or delete on public.receivables
  for each row execute function public.audit_row();

-- Pagamenti ricevuti (anche più di uno per importo: acconti, rate)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'bonifico',
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_receivable_idx on public.payments (receivable_id);
create index payments_paid_on_idx on public.payments (paid_on);
create index payments_created_by_idx on public.payments (created_by);
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Rinnovo: sposta la scadenza al periodo successivo e (opzionale) crea l'importo
-- da far pagare al cliente. Gira con i permessi di chi lo chiama (RLS attiva).
-- ---------------------------------------------------------------------------
create or replace function public.renew_renewal(p_id uuid, p_create_receivable boolean default true)
returns date language plpgsql security invoker set search_path = public as $$
declare
  r public.renewals;
  step interval;
  new_due date;
begin
  select * into r from public.renewals where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Scadenza non trovata'; end if;
  step := case r.frequency
    when 'mensile' then interval '1 month'
    when 'trimestrale' then interval '3 months'
    when 'semestrale' then interval '6 months'
    when 'annuale' then interval '1 year'
    else interval '2 years' end;
  new_due := (r.next_due_date + step)::date;

  if p_create_receivable and r.client_id is not null and coalesce(r.price_cents, 0) > 0 then
    insert into public.receivables (client_id, project_id, renewal_id, description, amount_cents, due_date)
    values (r.client_id, r.project_id, r.id,
            'Rinnovo ' || r.type::text || ' ' || r.name || ' (' || to_char(r.next_due_date, 'DD/MM/YYYY') || ' → ' || to_char(new_due, 'DD/MM/YYYY') || ')',
            r.price_cents, r.next_due_date);
  end if;

  update public.renewals set next_due_date = new_due where id = p_id;
  return new_due;
end $$;
revoke execute on function public.renew_renewal(uuid, boolean) from public, anon;
grant execute on function public.renew_renewal(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Avvisi automatici: preavviso (default 30 giorni) e avviso a scadenza raggiunta.
-- Destinatari: admin, amministrazione, responsabile del cliente, PM del progetto.
-- ---------------------------------------------------------------------------
create or replace function public.notify_upcoming_renewals()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  sent integer := 0;
  days_left integer;
  label text;
begin
  for r in
    select rn.*, c.name as client_name, c.owner_id, p.manager_id
    from public.renewals rn
    left join public.clients c on c.id = rn.client_id
    left join public.projects p on p.id = rn.project_id
    where rn.active and rn.deleted_at is null
      and (
        (rn.next_due_date - rn.notify_days_before <= current_date and rn.next_due_date > current_date
          and rn.notified_for is distinct from rn.next_due_date)
        or (rn.next_due_date <= current_date and rn.notified_expired_for is distinct from rn.next_due_date)
      )
  loop
    days_left := r.next_due_date - current_date;
    label := r.type::text || ' ' || r.name || coalesce(' · ' || r.client_name, '');

    insert into public.notifications (user_id, type, title, body, link)
    select distinct u.id, 'scadenza',
      case when days_left = 1 then 'Scade domani'
           when days_left > 1 then 'Scadenza tra ' || days_left || ' giorni'
           when days_left = 0 then 'Scade oggi'
           when days_left = -1 then 'Scaduto da 1 giorno'
           else 'Scaduto da ' || abs(days_left) || ' giorni' end,
      label || ' — scadenza ' || to_char(r.next_due_date, 'DD/MM/YYYY')
        || case when r.auto_renew then ' (rinnovo automatico)' else '' end,
      '/scadenze?aperto=' || r.id
    from public.profiles u
    where u.active
      and (u.role in ('admin', 'amministrazione') or u.id = r.owner_id or u.id = r.manager_id);
    sent := sent + 1;

    if days_left > 0 then
      update public.renewals set notified_for = next_due_date where id = r.id;
    else
      update public.renewals set notified_for = next_due_date, notified_expired_for = next_due_date where id = r.id;
    end if;
  end loop;
  return sent;
end $$;
revoke execute on function public.notify_upcoming_renewals() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.renewals enable row level security;
alter table public.receivables enable row level security;
alter table public.payments enable row level security;

-- Scadenze: tutto il team le vede (chi gestisce server e domini deve saperlo); le gestiscono admin, amministrazione, PM
create policy renewals_select on public.renewals for select to authenticated using ((select public.is_staff()));
create policy renewals_insert on public.renewals for insert to authenticated with check ((select public.can_manage_money()));
create policy renewals_update on public.renewals for update to authenticated
  using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
create policy renewals_delete on public.renewals for delete to authenticated using ((select public.has_role(array['admin']::public.app_role[])));

-- Incassi e pagamenti: visibili a chi segue i soldi; li registrano admin, amministrazione, PM
create policy receivables_select on public.receivables for select to authenticated using ((select public.can_view_money()));
create policy receivables_insert on public.receivables for insert to authenticated with check ((select public.can_manage_money()));
create policy receivables_update on public.receivables for update to authenticated
  using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
create policy receivables_delete on public.receivables for delete to authenticated using ((select public.has_role(array['admin']::public.app_role[])));

create policy payments_select on public.payments for select to authenticated using ((select public.can_view_money()));
create policy payments_insert on public.payments for insert to authenticated with check ((select public.can_manage_money()));
create policy payments_update on public.payments for update to authenticated
  using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
create policy payments_delete on public.payments for delete to authenticated using ((select public.can_manage_money()));

revoke execute on function public.renewals_reset_notified() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pianificazione giornaliera degli avvisi (solo dove pg_cron è disponibile: Supabase)
-- 07:00 UTC = 08:00/09:00 in Italia
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('omnira-avvisi-scadenze', '0 7 * * *', 'select public.notify_upcoming_renewals()');
  end if;
end $$;

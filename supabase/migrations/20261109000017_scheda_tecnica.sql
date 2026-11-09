-- Scheda tecnica del progetto: come è fatto (tecnologie, pattern, link, note) e con quali servizi esterni.
-- La compila chiunque lavori al progetto (anche il team tecnico), non solo PM/amministratori.
-- Niente segreti: solo nomi, link e note (le chiavi restano nei pannelli dei fornitori).

create table public.project_tech (
  project_id uuid primary key references public.projects (id) on delete cascade,
  stack text[] not null default '{}',
  patterns text[] not null default '{}',
  repo_url text check (repo_url is null or repo_url ~* '^https?://'),
  prod_url text check (prod_url is null or prod_url ~* '^https?://'),
  staging_url text check (staging_url is null or staging_url ~* '^https?://'),
  notes text check (notes is null or char_length(notes) <= 20000),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create type public.tech_service_category as enum ('hosting', 'database', 'dominio', 'email', 'ai', 'pagamenti', 'storage', 'analytics', 'monitoraggio', 'repository', 'altro');

create table public.project_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  category public.tech_service_category not null default 'altro',
  purpose text check (purpose is null or char_length(purpose) <= 300),
  dashboard_url text check (dashboard_url is null or dashboard_url ~* '^https?://'),
  account text check (account is null or char_length(account) <= 200),
  plan text check (plan is null or char_length(plan) <= 120),
  owner text not null default 'omnira' check (owner in ('omnira', 'cliente')),
  notes text check (notes is null or char_length(notes) <= 2000),
  position integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_services_project_idx on public.project_services (project_id, position);

create trigger project_tech_updated_at before update on public.project_tech for each row execute function public.set_updated_at();
create trigger project_services_updated_at before update on public.project_services for each row execute function public.set_updated_at();
create trigger project_services_audit after insert or update or delete on public.project_services for each row execute function public.audit_row();

alter table public.project_tech enable row level security;
alter table public.project_services enable row level security;
create policy project_tech_all on public.project_tech for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy project_services_all on public.project_services for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
grant select, insert, update, delete on public.project_tech, public.project_services to authenticated;

-- Suggerimenti: tutte le tecnologie e i pattern già usati negli altri progetti
create or replace function public.tech_suggestions()
returns table (kind text, value text, uses integer) language sql stable security invoker set search_path = public as $$
  select 'stack', v, count(*)::int from public.project_tech, unnest(stack) v group by v
  union all
  select 'pattern', v, count(*)::int from public.project_tech, unnest(patterns) v group by v
  union all
  select 'provider', provider, count(*)::int from public.project_services group by provider
$$;
revoke execute on function public.tech_suggestions() from public, anon;
grant execute on function public.tech_suggestions() to authenticated;

-- =============================================================================
-- Omnira Gestionale — Migrazione 2: Progetti (M3), Task (M4), Collaborazione (M5)
-- =============================================================================

create type public.project_type as enum (
  'sito', 'ecommerce', 'software', 'app', 'gestionale', 'automazione_ai', 'seo', 'altro'
);
create type public.project_status as enum ('pianificato', 'attivo', 'in_pausa', 'completato', 'annullato');
create type public.billing_type as enum ('corpo', 'ore', 'canone');
create type public.phase_status as enum ('da_iniziare', 'in_corso', 'completata');
create type public.task_status as enum ('da_fare', 'in_corso', 'in_review', 'test', 'fatto');
create type public.task_priority as enum ('bassa', 'media', 'alta', 'urgente');

-- ---------------------------------------------------------------------------
-- Progetti
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null check (length(trim(name)) > 0),
  client_id uuid references public.clients (id) on delete restrict,
  type public.project_type not null default 'altro',
  status public.project_status not null default 'pianificato',
  billing_type public.billing_type not null default 'corpo',
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  budget_hours numeric(8,2) check (budget_hours is null or budget_hours >= 0),
  start_date date,
  due_date date,
  manager_id uuid references public.profiles (id) on delete set null,
  description text,
  lead_id uuid references public.leads (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint projects_dates check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_client_idx on public.projects (client_id) where deleted_at is null;
create index projects_status_idx on public.projects (status) where deleted_at is null;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function public.audit_row();

-- Codice progetto P-AAAA-NNN e data di completamento
create or replace function public.projects_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  yr text := to_char(coalesce(new.created_at, now()), 'YYYY');
  nxt int;
begin
  if tg_op = 'INSERT' and new.code is null then
    perform pg_advisory_xact_lock(hashtext('project_code_' || yr));
    select coalesce(max(substring(code from 'P-\d{4}-(\d+)')::int), 0) + 1 into nxt
    from public.projects where code like 'P-' || yr || '-%';
    new.code := 'P-' || yr || '-' || lpad(nxt::text, 3, '0');
  end if;
  if new.status = 'completato' and (tg_op = 'INSERT' or old.status is distinct from 'completato') then
    new.completed_at := now();
  elsif new.status <> 'completato' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- Fasi (Analisi → Progettazione → Sviluppo → Test → Rilascio)
create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position int not null default 0,
  status public.phase_status not null default 'da_iniziare',
  start_date date,
  due_date date,
  created_at timestamptz not null default now()
);
create index project_phases_project_idx on public.project_phases (project_id, position);

create or replace function public.projects_default_phases()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_phases (project_id, name, position)
  select new.id, p.name, p.pos
  from (values ('Analisi', 1), ('Progettazione', 2), ('Sviluppo', 3), ('Test', 4), ('Rilascio', 5)) as p(name, pos);
  if new.manager_id is not null then
    insert into public.project_members (project_id, user_id) values (new.id, new.manager_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger projects_default_phases after insert on public.projects
  for each row execute function public.projects_default_phases();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id, due_date);

-- ---------------------------------------------------------------------------
-- Task
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid references public.project_phases (id) on delete set null,
  parent_id uuid references public.tasks (id) on delete cascade,
  number int,
  title text not null check (length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'da_fare',
  priority public.task_priority not null default 'media',
  start_date date,
  due_date date,
  estimate_hours numeric(6,2) check (estimate_hours is null or estimate_hours >= 0),
  position double precision not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  unique (project_id, number)
);
create index tasks_project_idx on public.tasks (project_id, status, position) where deleted_at is null;
create index tasks_parent_idx on public.tasks (parent_id);
create index tasks_due_idx on public.tasks (due_date) where deleted_at is null and status <> 'fatto';
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.audit_row();

create or replace function public.tasks_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.number is null then
    perform pg_advisory_xact_lock(hashtext('task_number_' || new.project_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.tasks where project_id = new.project_id;
  end if;
  if new.status = 'fatto' and (tg_op = 'INSERT' or old.status is distinct from 'fatto') then
    new.completed_at := now();
  elsif new.status <> 'fatto' then
    new.completed_at := null;
  end if;
  -- un sotto-task appartiene sempre allo stesso progetto del padre
  if new.parent_id is not null then
    select project_id into new.project_id from public.tasks where id = new.parent_id;
  end if;
  return new;
end $$;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);

-- ---------------------------------------------------------------------------
-- Commenti (su task, progetti, clienti, lead) e notifiche
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'project', 'client', 'lead')),
  entity_id uuid not null,
  body text not null check (length(trim(body)) > 0),
  mentions uuid[] not null default '{}',
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Assegnazione → notifica all'assegnatario (non a chi assegna sé stesso)
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  if new.user_id = auth.uid() then return new; end if;
  select tk.id, tk.title, tk.number, p.code, p.id as project_id
    into t from public.tasks tk join public.projects p on p.id = tk.project_id where tk.id = new.task_id;
  insert into public.notifications (user_id, type, title, body, link, actor_id)
  values (new.user_id, 'task_assegnato', 'Ti è stato assegnato un task',
          t.code || '-' || t.number || ' · ' || t.title, '/task?aperto=' || t.id, auth.uid());
  return new;
end $$;
create trigger task_assignees_notify after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- Commento → notifica a menzionati e (sui task) agli assegnatari
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  author_name text;
  link_to text;
  label text;
begin
  select full_name into author_name from public.profiles where id = new.author_id;
  if new.entity_type = 'task' then
    select tk.title, tk.number, p.code into t from public.tasks tk join public.projects p on p.id = tk.project_id where tk.id = new.entity_id;
    link_to := '/task?aperto=' || new.entity_id;
    label := t.code || '-' || t.number || ' · ' || t.title;
  elsif new.entity_type = 'project' then
    select name into label from public.projects where id = new.entity_id;
    link_to := '/progetti/' || new.entity_id || '?scheda=discussione';
  elsif new.entity_type = 'client' then
    select name into label from public.clients where id = new.entity_id;
    link_to := '/clienti/' || new.entity_id;
  else
    select title into label from public.leads where id = new.entity_id;
    link_to := '/lead?aperto=' || new.entity_id;
  end if;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select distinct u, case when u = any (new.mentions) then 'menzione' else 'commento' end,
         case when u = any (new.mentions) then author_name || ' ti ha menzionato' else author_name || ' ha commentato' end,
         coalesce(label, '') || ': ' || left(new.body, 140), link_to, new.author_id
  from (
    select unnest(new.mentions) as u
    union
    select ta.user_id from public.task_assignees ta where new.entity_type = 'task' and ta.task_id = new.entity_id
  ) r
  where u <> new.author_id and exists (select 1 from public.profiles where id = u and active);
  return new;
end $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- ---------------------------------------------------------------------------
-- Avanzamento progetto (task principali completati / totali)
-- ---------------------------------------------------------------------------
create or replace view public.project_progress
with (security_invoker = true) as
select p.id as project_id,
       count(t.id) filter (where t.parent_id is null) as total_tasks,
       count(t.id) filter (where t.parent_id is null and t.status = 'fatto') as done_tasks,
       count(t.id) filter (where t.parent_id is null and t.status <> 'fatto' and t.due_date < current_date) as overdue_tasks,
       coalesce(sum(t.estimate_hours) filter (where t.parent_id is null), 0) as estimated_hours
from public.projects p
left join public.tasks t on t.project_id = p.id and t.deleted_at is null
where p.deleted_at is null
group by p.id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_phases enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

-- Progetti: tutto il team legge; admin e PM gestiscono
create policy projects_select on public.projects for select to authenticated using (public.is_staff());
create policy projects_insert on public.projects for insert to authenticated
  with check (public.has_role(array['admin', 'project_manager']::public.app_role[]));
create policy projects_update on public.projects for update to authenticated
  using (public.has_role(array['admin', 'project_manager']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager']::public.app_role[]));
create policy projects_delete on public.projects for delete to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

create policy members_select on public.project_members for select to authenticated using (public.is_staff());
create policy members_write on public.project_members for all to authenticated
  using (public.has_role(array['admin', 'project_manager']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager']::public.app_role[]));

create policy phases_select on public.project_phases for select to authenticated using (public.is_staff());
create policy phases_write on public.project_phases for all to authenticated
  using (public.has_role(array['admin', 'project_manager']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager']::public.app_role[]));

create policy milestones_select on public.milestones for select to authenticated using (public.is_staff());
create policy milestones_write on public.milestones for all to authenticated
  using (public.has_role(array['admin', 'project_manager']::public.app_role[]))
  with check (public.has_role(array['admin', 'project_manager']::public.app_role[]));

-- Task: tutto il team legge, crea e aggiorna (stato, assegnazioni); eliminano admin e PM
create policy tasks_select on public.tasks for select to authenticated using (public.is_staff());
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_staff());
create policy tasks_update on public.tasks for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.has_role(array['admin', 'project_manager']::public.app_role[]));

create policy assignees_select on public.task_assignees for select to authenticated using (public.is_staff());
create policy assignees_write on public.task_assignees for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Commenti: tutti leggono e scrivono; modifica/cancella l'autore (o admin per cancellare)
create policy comments_select on public.comments for select to authenticated using (public.is_staff());
create policy comments_insert on public.comments for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.has_role(array['admin']::public.app_role[]));

-- Notifiche: ognuno vede e segna come lette solo le proprie (create dai trigger)
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime (solo su Supabase, dove esiste la pubblicazione)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.tasks, public.comments;
  end if;
end $$;

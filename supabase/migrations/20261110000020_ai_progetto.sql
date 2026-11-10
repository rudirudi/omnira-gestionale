-- Scheda AI del progetto: prompt con varianti/versioni, esiti dei test e discussione per prompt.
-- Niente chiavi: solo testi, modelli e note (le chiavi restano nei pannelli dei fornitori).

create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind text not null default 'prompt' check (kind in ('system', 'prompt', 'agente', 'template', 'estrazione', 'altro')),
  purpose text check (purpose is null or char_length(purpose) <= 1000),
  status text not null default 'bozza' check (status in ('bozza', 'in_test', 'in_produzione', 'archiviato')),
  production_version_id uuid,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_prompts_project_idx on public.ai_prompts (project_id, updated_at desc);

create table public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.ai_prompts (id) on delete cascade,
  number integer not null,
  label text check (label is null or char_length(label) <= 120),
  body text not null check (char_length(body) between 1 and 100000),
  model text check (model is null or char_length(model) <= 120),
  temperature numeric(3, 2) check (temperature is null or temperature between 0 and 2),
  max_tokens integer check (max_tokens is null or max_tokens between 1 and 1000000),
  change_note text check (change_note is null or char_length(change_note) <= 2000),
  result text check (result is null or char_length(result) <= 10000),
  rating smallint check (rating is null or rating between 1 and 5),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (prompt_id, number)
);

alter table public.ai_prompts
  add constraint ai_prompts_production_version_fkey foreign key (production_version_id) references public.ai_prompt_versions (id) on delete set null;

-- Numero progressivo per prompt (v1, v2…) e "tocca" il prompt
create or replace function public.ai_versions_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.ai_prompts where id = new.prompt_id for update;
  select coalesce(max(number), 0) + 1 into new.number from public.ai_prompt_versions where prompt_id = new.prompt_id;
  return new;
end $$;
create trigger ai_versions_before_insert before insert on public.ai_prompt_versions for each row execute function public.ai_versions_before_insert();

create or replace function public.ai_versions_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ai_prompts set updated_at = now() where id = coalesce(new.prompt_id, old.prompt_id);
  return null;
end $$;
create trigger ai_versions_touch after insert or update on public.ai_prompt_versions for each row execute function public.ai_versions_touch();

-- La versione in produzione deve appartenere al prompt
create or replace function public.ai_prompts_check_version()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.production_version_id is not null and not exists (
    select 1 from public.ai_prompt_versions v where v.id = new.production_version_id and v.prompt_id = new.id
  ) then
    raise exception 'versione non valida' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger ai_prompts_check_version before insert or update of production_version_id on public.ai_prompts for each row execute function public.ai_prompts_check_version();

create trigger ai_prompts_updated_at before update on public.ai_prompts for each row execute function public.set_updated_at();
create trigger ai_prompts_audit after insert or update or delete on public.ai_prompts for each row execute function public.audit_row();
create trigger ai_prompt_versions_audit after insert or update or delete on public.ai_prompt_versions for each row execute function public.audit_row();

alter table public.ai_prompts enable row level security;
alter table public.ai_prompt_versions enable row level security;
create policy ai_prompts_all on public.ai_prompts for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy ai_prompt_versions_all on public.ai_prompt_versions for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
grant select, insert, update, delete on public.ai_prompts, public.ai_prompt_versions to authenticated;
revoke execute on function public.ai_versions_before_insert(), public.ai_versions_touch(), public.ai_prompts_check_version() from public, anon, authenticated;

-- Discussione per prompt: riusa i commenti
alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('task', 'project', 'client', 'lead', 'discussion', 'ai_prompt'));

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
  elsif new.entity_type = 'discussion' then
    select '#' || number || ' · ' || title into label from public.discussions where id = new.entity_id;
    link_to := '/discussioni/' || new.entity_id;
  elsif new.entity_type = 'ai_prompt' then
    select 'Prompt «' || ap.title || '» · ' || p.code, '/progetti/' || ap.project_id || '?scheda=ai&prompt=' || ap.id
      into label, link_to
      from public.ai_prompts ap join public.projects p on p.id = ap.project_id where ap.id = new.entity_id;
  else
    select title into label from public.leads where id = new.entity_id;
    link_to := '/lead?aperto=' || new.entity_id;
  end if;

  insert into public.notifications (user_id, type, title, body, link, actor_id)
  select distinct u, case when u = any (new.mentions) then 'menzione' else 'commento' end,
         case when u = any (new.mentions) then author_name || ' ti ha menzionato'
              when new.entity_type = 'discussion' then author_name || ' ha risposto'
              else author_name || ' ha commentato' end,
         coalesce(label, '') || ': ' || left(new.body, 140), link_to, new.author_id
  from (
    select unnest(new.mentions) as u
    union
    select ta.user_id from public.task_assignees ta where new.entity_type = 'task' and ta.task_id = new.entity_id
    union
    select d.created_by from public.discussions d where new.entity_type = 'discussion' and d.id = new.entity_id
    union
    select d.owner_id from public.discussions d where new.entity_type = 'discussion' and d.id = new.entity_id
    union
    select ap.created_by from public.ai_prompts ap where new.entity_type = 'ai_prompt' and ap.id = new.entity_id
    union
    select c.author_id from public.comments c
     where new.entity_type in ('discussion', 'ai_prompt') and c.entity_type = new.entity_type and c.entity_id = new.entity_id
  ) r
  where u is not null and u <> new.author_id and exists (select 1 from public.profiles where id = u and active);
  return new;
end $$;
revoke execute on function public.notify_comment() from public, anon, authenticated;

-- Conteggio commenti per prompt (per l'elenco)
create or replace function public.ai_prompt_comment_counts(p_project uuid)
returns table (prompt_id uuid, comments integer) language sql stable security invoker set search_path = public as $$
  select c.entity_id, count(*)::int from public.comments c
  join public.ai_prompts ap on ap.id = c.entity_id and ap.project_id = p_project
  where c.entity_type = 'ai_prompt' group by c.entity_id
$$;
revoke execute on function public.ai_prompt_comment_counts(uuid) from public, anon;
grant execute on function public.ai_prompt_comment_counts(uuid) to authenticated;

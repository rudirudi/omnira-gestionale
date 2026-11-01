-- =============================================================================
-- Migrazione 4: prestazioni (suggerimenti dell'analisi Supabase)
-- 1) auth.uid() valutato una volta per query, non per ogni riga: (select auth.uid())
-- 2) una sola policy permissiva per azione (niente doppio controllo in lettura)
-- 3) indici sulle chiavi esterne usate nei join
-- =============================================================================

-- 1) Policy con (select auth.uid())
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select public.is_staff()) or id = (select auth.uid()));
drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])))
  with check (id = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])));

drop policy activities_insert on public.activities;
create policy activities_insert on public.activities for insert to authenticated
  with check ((select public.is_staff()) and created_by = (select auth.uid()));
drop policy activities_update on public.activities;
create policy activities_update on public.activities for update to authenticated
  using (created_by = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])))
  with check (created_by = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])));
drop policy activities_delete on public.activities;
create policy activities_delete on public.activities for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])));

drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check ((select public.is_staff()) and author_id = (select auth.uid()));
drop policy comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])));

drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- 2) Le policy "for all" si sovrapponevano a quelle di lettura: separate per azione
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('sites', 'sites_write', 'array[''admin'']'),
      ('contacts', 'contacts_write', 'array[''admin'', ''project_manager'', ''commerciale'', ''amministrazione'']'),
      ('project_members', 'members_write', 'array[''admin'', ''project_manager'']'),
      ('project_phases', 'phases_write', 'array[''admin'', ''project_manager'']'),
      ('milestones', 'milestones_write', 'array[''admin'', ''project_manager'']')
    ) as v(tbl, pol, roles)
  loop
    execute format('drop policy %I on public.%I', t.pol, t.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.has_role(%s::public.app_role[])))', t.tbl || '_insert', t.tbl, t.roles);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.has_role(%s::public.app_role[]))) with check ((select public.has_role(%s::public.app_role[])))', t.tbl || '_update', t.tbl, t.roles, t.roles);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.has_role(%s::public.app_role[])))', t.tbl || '_delete', t.tbl, t.roles);
  end loop;
end $$;

drop policy assignees_write on public.task_assignees;
create policy task_assignees_insert on public.task_assignees for insert to authenticated with check ((select public.is_staff()));
create policy task_assignees_update on public.task_assignees for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy task_assignees_delete on public.task_assignees for delete to authenticated using ((select public.is_staff()));

-- Le altre policy di lettura: funzione valutata una volta per query
do $$
declare
  t text;
begin
  foreach t in array array['sites', 'company_settings', 'clients', 'contacts', 'leads', 'activities', 'projects',
                           'project_members', 'project_phases', 'milestones', 'tasks', 'task_assignees', 'comments']
  loop
    execute format(
      'alter policy %I on public.%I using ((select public.is_staff()))',
      case t when 'company_settings' then 'settings_select' when 'project_members' then 'members_select'
             when 'project_phases' then 'phases_select' when 'task_assignees' then 'assignees_select' else t || '_select' end,
      t);
  end loop;
end $$;

-- 3) Indici sulle chiavi esterne
create index if not exists activities_created_by_idx on public.activities (created_by);
create index if not exists clients_owner_idx on public.clients (owner_id);
create index if not exists clients_created_by_idx on public.clients (created_by);
create index if not exists comments_author_idx on public.comments (author_id);
create index if not exists leads_client_idx on public.leads (client_id);
create index if not exists leads_owner_idx on public.leads (owner_id);
create index if not exists leads_created_by_idx on public.leads (created_by);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists profiles_site_idx on public.profiles (site_id);
create index if not exists projects_manager_idx on public.projects (manager_id);
create index if not exists projects_lead_idx on public.projects (lead_id);
create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists task_assignees_assigned_by_idx on public.task_assignees (assigned_by);
create index if not exists tasks_phase_idx on public.tasks (phase_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);

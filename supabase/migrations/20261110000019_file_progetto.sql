-- File del progetto: i file stanno nello spazio file privato (bucket "project-files"),
-- qui solo i dati (nome, dimensione, chi l'ha caricato). Si scaricano con link temporanei.
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/'),
  name text not null check (char_length(name) between 1 and 255),
  size_bytes bigint not null check (size_bytes >= 0),
  mime text,
  category text not null default 'documento' check (category in ('documento', 'grafica', 'contratto', 'materiale_cliente', 'tecnico', 'altro')),
  note text check (note is null or char_length(note) <= 500),
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_files_project_idx on public.project_files (project_id, created_at desc);
create trigger project_files_audit after insert or update or delete on public.project_files for each row execute function public.audit_row();

alter table public.project_files enable row level security;
create policy project_files_select on public.project_files for select to authenticated using ((select public.is_staff()));
create policy project_files_insert on public.project_files for insert to authenticated
  with check ((select public.is_staff()) and uploaded_by = (select auth.uid()) and split_part(path, '/', 1) = project_id::text);
create policy project_files_update on public.project_files for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
-- Elimina chi l'ha caricato, oppure un amministratore
create policy project_files_delete on public.project_files for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[])));
grant select, insert, update (category, note), delete on public.project_files to authenticated;

-- Spazio file privato (solo dove esiste lo storage di Supabase)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('project-files', 'project-files', false, 52428800)
    on conflict (id) do nothing;

    execute $p$create policy "project_files_read" on storage.objects for select to authenticated
      using (bucket_id = 'project-files' and (select public.is_staff()))$p$;
    execute $p$create policy "project_files_write" on storage.objects for insert to authenticated
      with check (bucket_id = 'project-files' and (select public.is_staff()))$p$;
    execute $p$create policy "project_files_remove" on storage.objects for delete to authenticated
      using (bucket_id = 'project-files' and (owner = (select auth.uid()) or (select public.has_role(array['admin']::public.app_role[]))))$p$;
  end if;
end $$;

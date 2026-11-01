-- =============================================================================
-- Migrazione 5: registrazioni aperte in sicurezza
-- - Primo utente: admin attivo
-- - Invitati da un admin (Supabase "Invite user"): attivi subito, ruolo Team
-- - Registrati da soli (email o Google): DISATTIVATI finché un admin non li attiva
-- - A ogni nuova registrazione in attesa, notifica a tutti gli admin attivi
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  invited boolean := new.invited_at is not null;
  display_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
begin
  perform pg_advisory_xact_lock(hashtext('handle_new_user'));
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    display_name,
    case when first_user then 'admin'::public.app_role else 'team'::public.app_role end,
    first_user or invited
  );

  if not first_user and not invited then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'nuovo_utente', 'Nuovo utente in attesa di attivazione',
           display_name || ' (' || coalesce(new.email, '') || ') si è registrato. Attivalo e assegnagli un ruolo.',
           '/impostazioni?scheda=team'
    from public.profiles p
    where p.role = 'admin' and p.active and p.id <> new.id;
  end if;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Chat interna tra gli utenti del gestionale: messaggi diretti e canale "Generale".
-- I messaggi arrivano in tempo reale (Supabase Realtime); chi non li legge entro 5 minuti
-- riceve un avviso nella campanella e, se li ha attivati, su email/Telegram.

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('diretta', 'canale')),
  name text,
  slug text unique,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'diretta' or name is not null)
);

create table public.chat_members (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  notified_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create index chat_messages_conv_idx on public.chat_messages (conversation_id, created_at desc);

-- Appartenenza (security definer: usata dalle policy senza ricorsione)
create or replace function public.is_chat_member(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_members m join public.profiles p on p.id = m.user_id and p.active
    where m.conversation_id = conv and m.user_id = auth.uid()
  )
$$;
revoke execute on function public.is_chat_member(uuid) from public, anon;
grant execute on function public.is_chat_member(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

create policy chat_conv_select on public.chat_conversations for select to authenticated
  using ((select public.is_chat_member(id)));
create policy chat_members_select on public.chat_members for select to authenticated
  using ((select public.is_chat_member(conversation_id)));
create policy chat_msg_select on public.chat_messages for select to authenticated
  using ((select public.is_chat_member(conversation_id)));
create policy chat_msg_insert on public.chat_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_chat_member(conversation_id)));
create policy chat_msg_update on public.chat_messages for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));

grant select on public.chat_conversations, public.chat_members to authenticated;
grant select, insert, update (body, deleted_at) on public.chat_messages to authenticated;

-- Modifica/cancellazione: solo testo e cancellazione logica; la data di modifica la mette il database
create or replace function public.chat_messages_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.conversation_id <> old.conversation_id or new.author_id is distinct from old.author_id or new.created_at <> old.created_at then
    raise exception 'Messaggio non modificabile';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_at := now();
    new.body := '·';
  elsif new.body <> old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger chat_messages_before_update before update on public.chat_messages
  for each row execute function public.chat_messages_before_update();

-- Nuovo messaggio: aggiorna la conversazione e segna letto per chi scrive
create or replace function public.chat_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.chat_members set last_read_at = greatest(last_read_at, new.created_at)
    where conversation_id = new.conversation_id and user_id = new.author_id;
  return new;
end $$;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function public.chat_messages_after_insert();
revoke execute on function public.chat_messages_before_update(), public.chat_messages_after_insert() from public, anon, authenticated;

-- Canale Generale: tutti gli utenti attivi, anche quelli attivati in futuro
insert into public.chat_conversations (kind, name, slug) values ('canale', 'Generale', 'generale');
insert into public.chat_members (conversation_id, user_id)
  select c.id, p.id from public.chat_conversations c, public.profiles p where c.slug = 'generale' and p.active;

create or replace function public.chat_join_general()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.active then
    insert into public.chat_members (conversation_id, user_id)
      select id, new.id from public.chat_conversations where slug = 'generale'
      on conflict do nothing;
  end if;
  return new;
end $$;
create trigger profiles_chat_join_general after insert or update of active on public.profiles
  for each row execute function public.chat_join_general();
revoke execute on function public.chat_join_general() from public, anon, authenticated;

-- Apre (o crea) la conversazione diretta con un collega
create or replace function public.chat_open_direct(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if not public.is_staff() then raise exception 'Non autorizzato'; end if;
  if other is null or other = me then raise exception 'Scegli un collega'; end if;
  if not exists (select 1 from public.profiles where id = other and active) then raise exception 'Utente non attivo'; end if;
  perform pg_advisory_xact_lock(hashtext('chat_direct_' || least(me, other)::text || greatest(me, other)::text));
  select c.id into conv from public.chat_conversations c
    where c.kind = 'diretta'
      and exists (select 1 from public.chat_members where conversation_id = c.id and user_id = me)
      and exists (select 1 from public.chat_members where conversation_id = c.id and user_id = other)
    limit 1;
  if conv is null then
    insert into public.chat_conversations (kind, created_by) values ('diretta', me) returning id into conv;
    insert into public.chat_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
end $$;
revoke execute on function public.chat_open_direct(uuid) from public, anon;
grant execute on function public.chat_open_direct(uuid) to authenticated;

-- Segna letta una conversazione (e le relative notifiche nella campanella)
create or replace function public.chat_mark_read(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.chat_members set last_read_at = now(), notified_at = null
    where conversation_id = conv and user_id = auth.uid();
  update public.notifications set read_at = now()
    where user_id = auth.uid() and type = 'messaggio' and read_at is null and link = '/chat?c=' || conv;
end $$;
revoke execute on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_mark_read(uuid) to authenticated;

-- Elenco conversazioni con ultimo messaggio e non letti (rispetta le policy di chi chiama)
create or replace function public.chat_overview()
returns table (
  id uuid, kind text, name text, other_id uuid, other_name text,
  last_body text, last_author uuid, last_at timestamptz, last_deleted boolean, unread integer
) language sql stable security invoker set search_path = public as $$
  select c.id, c.kind, c.name, o.user_id, op.full_name,
         lm.body, lm.author_id, coalesce(lm.created_at, c.created_at), lm.deleted_at is not null,
         (select count(*)::int from public.chat_messages x
            where x.conversation_id = c.id and x.created_at > me.last_read_at
              and x.author_id is distinct from auth.uid() and x.deleted_at is null)
  from public.chat_members me
  join public.chat_conversations c on c.id = me.conversation_id
  left join lateral (select m.user_id from public.chat_members m where m.conversation_id = c.id and m.user_id <> me.user_id limit 1) o on c.kind = 'diretta'
  left join public.profiles op on op.id = o.user_id
  left join lateral (select * from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  where me.user_id = auth.uid()
  order by c.kind = 'canale' desc, coalesce(lm.created_at, c.created_at) desc
$$;
revoke execute on function public.chat_overview() from public, anon;
grant execute on function public.chat_overview() to authenticated;

create or replace function public.chat_unread_total()
returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.chat_messages x
  join public.chat_members me on me.conversation_id = x.conversation_id and me.user_id = auth.uid()
  where x.created_at > me.last_read_at and x.author_id is distinct from auth.uid() and x.deleted_at is null
$$;
revoke execute on function public.chat_unread_total() from public, anon;
grant execute on function public.chat_unread_total() to authenticated;

-- Avvisi per i messaggi non letti da più di 5 minuti: una notifica per conversazione,
-- poi silenzio finché non si legge (notified_at si azzera alla lettura)
create or replace function public.chat_notify_unread()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select me.conversation_id, me.user_id, c.kind, c.name,
           count(*) as cnt,
           (array_agg(x.body order by x.created_at desc))[1] as last_body,
           (array_agg(ap.full_name order by x.created_at desc))[1] as last_author
    from public.chat_members me
    join public.profiles p on p.id = me.user_id and p.active
    join public.chat_conversations c on c.id = me.conversation_id
    join public.chat_messages x on x.conversation_id = me.conversation_id
      and x.created_at > me.last_read_at and x.author_id is distinct from me.user_id and x.deleted_at is null
    left join public.profiles ap on ap.id = x.author_id
    where me.notified_at is null
    group by me.conversation_id, me.user_id, c.kind, c.name
    having max(x.created_at) < now() - interval '5 minutes'
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (
      r.user_id, 'messaggio',
      case when r.kind = 'canale' then 'Nuovi messaggi in #' || r.name
           when r.cnt = 1 then 'Nuovo messaggio da ' || coalesce(r.last_author, 'un collega')
           else r.cnt || ' messaggi da ' || coalesce(r.last_author, 'un collega') end,
      case when r.kind = 'canale' then coalesce(split_part(r.last_author, ' ', 1) || ': ', '') else '' end
        || left(r.last_body, 140) || case when char_length(r.last_body) > 140 then '…' else '' end,
      '/chat?c=' || r.conversation_id
    );
    update public.chat_members set notified_at = now() where conversation_id = r.conversation_id and user_id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.chat_notify_unread() from public, anon, authenticated;

-- Consegna email/Telegram: ora anche i messaggi di chat
create or replace function public.deliver_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  u record;
  n record;
  rows_html text;
  tg text;
  cnt integer;
  base text;
  any_sent boolean;
  any_channel boolean;
  subj text;
  email_ok boolean;
  tg_ok boolean;
  delivered integer := 0;
begin
  select rtrim(app_url, '/') into base from public.company_settings where id = 1;
  -- Canali non ancora attivi: si saltano senza scrivere nel registro (le notifiche aspettano)
  email_ok := exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key' and coalesce(decrypted_secret, '') <> '');
  tg_ok := exists (select 1 from vault.decrypted_secrets where name = 'telegram_bot_token' and coalesce(decrypted_secret, '') <> '');
  for u in
    select p.id, p.full_name, p.email_notifications, p.notify_telegram, p.telegram_chat_id,
           coalesce(nullif(p.notification_email, ''), au.email) as to_email
    from public.profiles p join auth.users au on au.id = p.id
    where p.active
      and exists (select 1 from public.notifications x where x.user_id = p.id and x.type in ('scadenza', 'promemoria', 'messaggio')
                  and x.delivered_at is null and x.created_at > now() - interval '24 hours')
  loop
    rows_html := ''; tg := ''; cnt := 0; subj := null;
    for n in
      select * from public.notifications
      where user_id = u.id and type in ('scadenza', 'promemoria', 'messaggio') and delivered_at is null and created_at > now() - interval '24 hours'
      order by created_at
    loop
      cnt := cnt + 1;
      subj := coalesce(subj, case when n.type = 'promemoria' then 'Promemoria: ' || n.title when n.type = 'messaggio' then n.title else n.title || ' · ' || split_part(coalesce(n.body, ''), ' — ', 1) end);
      rows_html := rows_html
        || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #e3e7ef;border-left:4px solid '
        || case when n.type in ('promemoria', 'messaggio') then '#1F4196' when n.title like 'Scad%uto%' or n.title = 'Scade oggi' then '#DC2626' else '#F5B800' end
        || ';border-radius:8px"><tr><td style="padding:12px 14px">'
        || '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.06em;color:#8a93a6;text-transform:uppercase">' || case n.type when 'promemoria' then 'Promemoria' when 'messaggio' then 'Chat' else 'Scadenza' end || '</p>'
        || '<p style="margin:2px 0 0;font-size:14px;font-weight:600">' || html_escape(n.title) || '</p>'
        || '<p style="margin:3px 0 0;font-size:13px;color:#5b6478">' || html_escape(n.body) || '</p>'
        || case when n.link is not null then '<p style="margin:6px 0 0;font-size:13px"><a href="' || base || html_escape(n.link) || '" style="color:#1F4196">Apri nel gestionale →</a></p>' else '' end
        || '</td></tr></table>';
      tg := tg || E'\n\n' || case n.type when 'promemoria' then '🔔 ' when 'messaggio' then '💬 ' else '📅 ' end || '<b>' || html_escape(n.title) || '</b>'
        || E'\n' || html_escape(n.body)
        || case when n.link is not null then E'\n<a href="' || base || html_escape(n.link) || '">Apri</a>' else '' end;
    end loop;
    if cnt > 1 then subj := 'Gestionale: ' || cnt || ' avvisi'; end if;

    any_sent := false;
    any_channel := false;
    if u.email_notifications and u.to_email is not null then
      any_channel := true;
      if email_ok and public.send_email(u.to_email, subj,
           public.email_layout('Ciao ' || html_escape(split_part(u.full_name, ' ', 1)) || ',',
             case when cnt = 1 then 'hai un nuovo avviso:' else 'hai ' || cnt || ' nuovi avvisi:' end,
             rows_html, base, 'Apri il gestionale'),
           'notifiche') is not null then any_sent := true; end if;
    end if;
    if u.notify_telegram and u.telegram_chat_id is not null then
      any_channel := true;
      if tg_ok and public.send_telegram(u.telegram_chat_id, '<b>Omnira · ' || case when cnt = 1 then '1 avviso' else cnt || ' avvisi' end || '</b>' || tg, 'telegram') is not null then any_sent := true; end if;
    end if;

    -- Nessun canale scelto: niente da fare. Canale scelto ma non ancora attivo: riprova al giro dopo (entro 24 ore)
    if any_sent or not any_channel then
      update public.notifications set delivered_at = now()
        where user_id = u.id and type in ('scadenza', 'promemoria', 'messaggio') and delivered_at is null and created_at > now() - interval '24 hours';
      if any_sent then delivered := delivered + 1; end if;
    end if;
  end loop;
  return delivered;
end $$;
revoke execute on function public.deliver_notifications() from public, anon, authenticated;

-- Tempo reale
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages, public.chat_members;
  end if;
end $$;

-- Il giro ogni 10 minuti ora controlla anche i messaggi non letti
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omnira-consegna-notifiche', '*/10 * * * *',
      'select public.notify_due_activities(); select public.chat_notify_unread(); select public.deliver_notifications();');
  end if;
end $$;

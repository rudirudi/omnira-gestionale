-- =============================================================================
-- Migrazione 11: Notifiche su più canali + promemoria come notifiche
-- - Promemoria (attività con data) → notifica alla data/ora a chi l'ha creato
-- - Ogni persona sceglie i canali: email (di registrazione o un'altra),
--   Telegram (collegato con un clic), WhatsApp (preferenza salvata)
-- - Ogni 10 minuti le notifiche nuove di scadenze e promemoria partono sui canali
-- Segreti solo nel Vault: resend_api_key, telegram_bot_token, telegram_webhook_secret
-- =============================================================================

alter table public.profiles
  add column if not exists notification_email text check (notification_email is null or notification_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column if not exists notify_telegram boolean not null default false,
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_username text,
  add column if not exists telegram_link_code text,
  add column if not exists notify_whatsapp boolean not null default false,
  add column if not exists whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+?[0-9 ]{8,20}$');

alter table public.notifications add column if not exists delivered_at timestamptz;
update public.notifications set delivered_at = emailed_at where emailed_at is not null and delivered_at is null;

alter table public.activities add column if not exists notified_at timestamptz;
-- Promemoria vecchi: niente valanga di notifiche al primo giro
update public.activities set notified_at = now() where due_at is not null and due_at < now() - interval '1 day' and notified_at is null;

alter table public.company_settings
  add column if not exists telegram_bot_username text,
  add column if not exists telegram_getme_request bigint;

-- La chat Telegram si collega solo dal bot (funzione telegram_link): l'utente può solo scollegarla
create or replace function public.protect_telegram_chat()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('omnira.telegram_link', true), '') <> '1'
     and new.telegram_chat_id is distinct from old.telegram_chat_id and new.telegram_chat_id is not null then
    raise exception 'La chat Telegram si collega dal bot, non a mano';
  end if;
  return new;
end $$;
revoke execute on function public.protect_telegram_chat() from public, anon, authenticated;
create trigger profiles_protect_telegram before update on public.profiles
  for each row execute function public.protect_telegram_chat();

-- Se cambia la data di un promemoria, avvisa di nuovo alla nuova data
create or replace function public.activities_reset_notified()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.due_at is distinct from old.due_at then new.notified_at := null; end if;
  return new;
end $$;
revoke execute on function public.activities_reset_notified() from public, anon, authenticated;
create trigger activities_reset_notified before update of due_at on public.activities
  for each row execute function public.activities_reset_notified();

-- ---------------------------------------------------------------------------
-- Promemoria → notifica (a chi l'ha creato; se non c'è più, agli amministratori)
-- ---------------------------------------------------------------------------
create or replace function public.notify_due_activities()
returns integer language plpgsql security definer set search_path = public as $$
declare
  a record;
  n integer := 0;
begin
  for a in
    select act.*, c.name as client_name, l.title as lead_title, l.company_name
    from public.activities act
    left join public.clients c on c.id = act.client_id
    left join public.leads l on l.id = act.lead_id
    where act.done_at is null and act.due_at is not null and act.due_at <= now() and act.notified_at is null
    for update of act
  loop
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'promemoria', a.subject,
      coalesce(a.client_name, a.company_name, a.lead_title, '')
        || ' · ' || to_char(a.due_at at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
      case when a.client_id is not null then '/clienti/' || a.client_id || '?scheda=attivita' else '/lead?aperto=' || a.lead_id end
    from public.profiles p
    where p.active and (p.id = a.created_by
      or (not exists (select 1 from public.profiles x where x.id = a.created_by and x.active) and p.role = 'admin'));
    update public.activities set notified_at = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.notify_due_activities() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Telegram
-- ---------------------------------------------------------------------------
create or replace function public.send_telegram(p_chat bigint, p_text text, p_kind text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  token text;
  req bigint;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if token is null or token = '' then
    insert into public.email_log (to_email, subject, kind, status, detail) values ('telegram:' || p_chat, left(p_text, 80), p_kind, 'senza_chiave', 'Bot Telegram non configurato');
    return null;
  end if;
  select net.http_post(
    url := 'https://api.telegram.org/bot' || token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', p_chat, 'text', p_text, 'parse_mode', 'HTML', 'disable_web_page_preview', true)
  ) into req;
  insert into public.email_log (to_email, subject, kind, request_id, status) values ('telegram:' || p_chat, left(regexp_replace(p_text, '<[^>]+>', '', 'g'), 80), p_kind, req, 'inviata');
  return req;
exception when others then
  insert into public.email_log (to_email, subject, kind, status, detail) values ('telegram:' || p_chat, left(p_text, 80), p_kind, 'errore', sqlerrm);
  return null;
end $$;
revoke execute on function public.send_telegram(bigint, text, text) from public, anon, authenticated;

-- Collegamento dal bot: /start <codice>. Chiamata dal webhook (senza sessione), verificata col segreto.
create or replace function public.telegram_link(p_secret text, p_code text, p_chat bigint, p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  expected text;
  who record;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'telegram_webhook_secret' limit 1;
  if expected is null or p_secret is distinct from expected then return 'non_autorizzato'; end if;

  if p_code is null or p_code = '' or p_code = 'stop' then
    if p_code = 'stop' then
      update public.profiles set telegram_chat_id = null, notify_telegram = false where telegram_chat_id = p_chat;
      perform public.send_telegram(p_chat, 'Notifiche disattivate. Puoi ricollegarti dal gestionale: Impostazioni → Notifiche.', 'telegram');
      return 'scollegato';
    end if;
    perform public.send_telegram(p_chat, 'Ciao! Per ricevere qui le notifiche, collega Telegram dal gestionale: Impostazioni → Notifiche → «Collega Telegram».', 'telegram');
    return 'senza_codice';
  end if;

  select id, full_name into who from public.profiles where telegram_link_code = p_code and active;
  if not found then
    perform public.send_telegram(p_chat, 'Codice non valido o scaduto. Riprova dal gestionale: Impostazioni → Notifiche → «Collega Telegram».', 'telegram');
    return 'codice_errato';
  end if;
  perform set_config('omnira.telegram_link', '1', true);
  update public.profiles set telegram_chat_id = null where telegram_chat_id = p_chat and id <> who.id;
  update public.profiles set telegram_chat_id = p_chat, telegram_username = p_username, telegram_link_code = null, notify_telegram = true where id = who.id;
  perform public.send_telegram(p_chat, '✅ Collegato! Ciao ' || public.html_escape(split_part(who.full_name, ' ', 1)) || ', da ora ricevi qui gli avvisi di scadenze e promemoria del gestionale Omnira. Scrivi /stop per disattivarli.', 'telegram');
  return 'collegato';
end $$;
revoke execute on function public.telegram_link(text, text, bigint, text) from public;
grant execute on function public.telegram_link(text, text, bigint, text) to anon;  -- solo il webhook del bot (verificato dal segreto)
revoke execute on function public.telegram_link(text, text, bigint, text) from authenticated;

-- Configura il bot (solo amministratori): webhook verso il gestionale + lettura del nome del bot
create or replace function public.telegram_setup()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  token text;
  secret text;
  base text;
  req bigint;
begin
  if not public.has_role(array['admin']::public.app_role[]) then raise exception 'Solo amministratori'; end if;
  select decrypted_secret into token from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if token is null or token = '' then return 'senza_token'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'telegram_webhook_secret' limit 1;
  if secret is null then
    secret := replace(gen_random_uuid()::text, '-', '');
    perform vault.create_secret(secret, 'telegram_webhook_secret');
  end if;
  select rtrim(app_url, '/') into base from public.company_settings where id = 1;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || token || '/setWebhook',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('url', base || '/api/telegram/webhook', 'secret_token', secret, 'allowed_updates', jsonb_build_array('message'))
  );
  select net.http_post(url := 'https://api.telegram.org/bot' || token || '/getMe', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) into req;
  update public.company_settings set telegram_getme_request = req, telegram_bot_username = null where id = 1;
  return 'ok';
end $$;
revoke execute on function public.telegram_setup() from public, anon;
grant execute on function public.telegram_setup() to authenticated;

-- Stato dei canali (nessun segreto restituito) + nome del bot per il link di collegamento
create or replace function public.notification_channels()
returns table (email_ready boolean, telegram_ready boolean, telegram_bot text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  bot text;
  req bigint;
  body text;
begin
  select telegram_bot_username, telegram_getme_request into bot, req from public.company_settings where id = 1;
  if bot is null and req is not null then
    select content into body from net._http_response where id = req and status_code = 200;
    if body is not null then
      bot := (body::jsonb) -> 'result' ->> 'username';
      if bot is not null then update public.company_settings set telegram_bot_username = bot where id = 1; end if;
    end if;
  end if;
  return query select
    exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key' and coalesce(decrypted_secret, '') <> ''),
    exists (select 1 from vault.decrypted_secrets where name = 'telegram_bot_token' and coalesce(decrypted_secret, '') <> '') and bot is not null,
    bot;
end $$;
revoke execute on function public.notification_channels() from public, anon;
grant execute on function public.notification_channels() to authenticated;

-- ---------------------------------------------------------------------------
-- Consegna: scadenze e promemoria nuovi → canali scelti da ciascuno
-- ---------------------------------------------------------------------------
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
      and exists (select 1 from public.notifications x where x.user_id = p.id and x.type in ('scadenza', 'promemoria')
                  and x.delivered_at is null and x.created_at > now() - interval '24 hours')
  loop
    rows_html := ''; tg := ''; cnt := 0; subj := null;
    for n in
      select * from public.notifications
      where user_id = u.id and type in ('scadenza', 'promemoria') and delivered_at is null and created_at > now() - interval '24 hours'
      order by created_at
    loop
      cnt := cnt + 1;
      subj := coalesce(subj, case when n.type = 'promemoria' then 'Promemoria: ' || n.title else n.title || ' · ' || split_part(coalesce(n.body, ''), ' — ', 1) end);
      rows_html := rows_html
        || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #e3e7ef;border-left:4px solid '
        || case when n.type = 'promemoria' then '#1F4196' when n.title like 'Scad%uto%' or n.title = 'Scade oggi' then '#DC2626' else '#F5B800' end
        || ';border-radius:8px"><tr><td style="padding:12px 14px">'
        || '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.06em;color:#8a93a6;text-transform:uppercase">' || case when n.type = 'promemoria' then 'Promemoria' else 'Scadenza' end || '</p>'
        || '<p style="margin:2px 0 0;font-size:14px;font-weight:600">' || html_escape(n.title) || '</p>'
        || '<p style="margin:3px 0 0;font-size:13px;color:#5b6478">' || html_escape(n.body) || '</p>'
        || case when n.link is not null then '<p style="margin:6px 0 0;font-size:13px"><a href="' || base || html_escape(n.link) || '" style="color:#1F4196">Apri nel gestionale →</a></p>' else '' end
        || '</td></tr></table>';
      tg := tg || E'\n\n' || case when n.type = 'promemoria' then '🔔 ' else '📅 ' end || '<b>' || html_escape(n.title) || '</b>'
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
        where user_id = u.id and type in ('scadenza', 'promemoria') and delivered_at is null and created_at > now() - interval '24 hours';
      if any_sent then delivered := delivered + 1; end if;
    end if;
  end loop;
  return delivered;
end $$;
revoke execute on function public.deliver_notifications() from public, anon, authenticated;

-- Prove personali: ognuno può provare i propri canali
create or replace function public.send_test_email()
returns text language plpgsql security definer set search_path = public as $$
declare
  addr text;
  base text;
begin
  select coalesce(nullif(p.notification_email, ''), au.email) into addr from public.profiles p join auth.users au on au.id = p.id where p.id = auth.uid();
  if addr is null then raise exception 'Utente non trovato'; end if;
  select rtrim(app_url, '/') into base from public.company_settings where id = 1;
  return case when public.send_email(addr, 'Prova notifiche del gestionale',
    public.email_layout('Funziona!', 'Questa è un''email di prova: gli avvisi di scadenze e promemoria arriveranno a questo indirizzo.', '', base, 'Apri il gestionale'),
    'prova') is null then 'non_attivo' else 'inviata:' || addr end;
end $$;
revoke execute on function public.send_test_email() from public, anon;
grant execute on function public.send_test_email() to authenticated;

create or replace function public.send_test_telegram()
returns text language plpgsql security definer set search_path = public as $$
declare
  chat bigint;
begin
  select telegram_chat_id into chat from public.profiles where id = auth.uid();
  if chat is null then return 'non_collegato'; end if;
  return case when public.send_telegram(chat, '👋 Prova riuscita: gli avvisi del gestionale arriveranno qui.', 'prova') is null then 'non_attivo' else 'inviata' end;
end $$;
revoke execute on function public.send_test_telegram() from public, anon;
grant execute on function public.send_test_telegram() to authenticated;

-- Il vecchio riepilogo email è sostituito dalla consegna ogni 10 minuti
drop function if exists public.send_renewal_digest();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'omnira-email-scadenze') then
      perform cron.unschedule('omnira-email-scadenze');
    end if;
    perform cron.schedule('omnira-consegna-notifiche', '*/10 * * * *', 'select public.notify_due_activities(); select public.deliver_notifications();');
  end if;
end $$;

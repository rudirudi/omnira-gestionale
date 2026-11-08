-- =============================================================================
-- Migrazione 10: Avvisi via email (Resend)
-- Ogni mattina, dopo il controllo scadenze, ogni persona riceve UNA email con
-- le nuove notifiche di scadenza (solo se ce ne sono e se non l'ha disattivato).
-- La chiave Resend sta nel Vault di Supabase (nome: resend_api_key): non passa
-- mai dall'app né da Vercel; la usa solo il database tramite pg_net.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

alter table public.profiles add column if not exists email_notifications boolean not null default true;
alter table public.notifications add column if not exists emailed_at timestamptz;
alter table public.company_settings
  add column if not exists app_url text not null default 'https://omnira-gestionale.vercel.app',
  add column if not exists email_from text not null default 'Omnira Gestionale <avvisi@omnirasoft.it>';

-- Registro invii (per capire se le email partono davvero)
create table public.email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  kind text not null,
  request_id bigint,          -- id della richiesta pg_net (risposta in net._http_response)
  status text not null,       -- inviata | senza_chiave | errore
  detail text,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
create policy email_log_select on public.email_log for select to authenticated using ((select public.has_role(array['admin']::public.app_role[])));

create or replace function public.html_escape(t text)
returns text language sql immutable set search_path = public as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- Invio di una email tramite Resend (asincrono: pg_net la spedisce dopo il commit)
create or replace function public.send_email(p_to text, p_subject text, p_html text, p_kind text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  api_key text;
  sender text;
  req bigint;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if api_key is null or api_key = '' then
    insert into public.email_log (to_email, subject, kind, status, detail)
    values (p_to, p_subject, p_kind, 'senza_chiave', 'Chiave resend_api_key non presente nel Vault');
    return null;
  end if;
  select email_from into sender from public.company_settings where id = 1;
  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', sender, 'to', jsonb_build_array(p_to), 'subject', p_subject, 'html', p_html)
  ) into req;
  insert into public.email_log (to_email, subject, kind, request_id, status) values (p_to, p_subject, p_kind, req, 'inviata');
  return req;
exception when others then
  insert into public.email_log (to_email, subject, kind, status, detail) values (p_to, p_subject, p_kind, 'errore', sqlerrm);
  return null;
end $$;
revoke execute on function public.send_email(text, text, text, text) from public, anon, authenticated;

-- Impaginazione comune delle email
create or replace function public.email_layout(p_title text, p_intro text, p_rows text, p_cta_url text, p_cta text)
returns text language sql immutable set search_path = public as $$
  select '<!doctype html><html><body style="margin:0;background:#eef1f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1b2233">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">'
    || '<tr><td style="background:#1F4196;padding:18px 24px;color:#fff;font-size:15px;font-weight:600">Omnira · Gestionale</td></tr>'
    || '<tr><td style="padding:24px"><h1 style="margin:0 0 6px;font-size:19px">' || p_title || '</h1>'
    || '<p style="margin:0 0 18px;color:#5b6478;font-size:14px">' || p_intro || '</p>'
    || p_rows
    || '<p style="margin:22px 0 0"><a href="' || p_cta_url || '" style="display:inline-block;background:#1F4196;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">' || p_cta || '</a></p>'
    || '</td></tr><tr><td style="padding:14px 24px;border-top:1px solid #e3e7ef;color:#8a93a6;font-size:12px">'
    || 'Ricevi questa email perché hai attivo «Ricevi avvisi via email» nel tuo profilo del gestionale.</td></tr>'
    || '</table></td></tr></table></body></html>'
$$;

-- Riepilogo: per ogni persona, le notifiche di scadenza nate nelle ultime 24 ore e non ancora inviate
create or replace function public.send_renewal_digest()
returns integer language plpgsql security definer set search_path = public as $$
declare
  u record;
  n record;
  rows text;
  cnt integer;
  base text;
  req bigint;
  sent integer := 0;
begin
  select rtrim(app_url, '/') into base from public.company_settings where id = 1;
  for u in
    select p.id, p.full_name, au.email
    from public.profiles p join auth.users au on au.id = p.id
    where p.active and p.email_notifications and au.email is not null
      and exists (select 1 from public.notifications x where x.user_id = p.id and x.type = 'scadenza' and x.emailed_at is null and x.created_at > now() - interval '24 hours')
  loop
    rows := '';
    cnt := 0;
    for n in
      select * from public.notifications
      where user_id = u.id and type = 'scadenza' and emailed_at is null and created_at > now() - interval '24 hours'
      order by created_at
    loop
      cnt := cnt + 1;
      rows := rows
        || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #e3e7ef;border-left:4px solid '
        || case when n.title like 'Scad%uto%' or n.title = 'Scade oggi' then '#DC2626' else '#F5B800' end
        || ';border-radius:8px"><tr><td style="padding:12px 14px">'
        || '<p style="margin:0;font-size:14px;font-weight:600">' || html_escape(n.title) || '</p>'
        || '<p style="margin:3px 0 0;font-size:13px;color:#5b6478">' || html_escape(n.body) || '</p>'
        || case when n.link is not null then '<p style="margin:6px 0 0;font-size:13px"><a href="' || base || html_escape(n.link) || '" style="color:#1F4196">Apri la scadenza →</a></p>' else '' end
        || '</td></tr></table>';
    end loop;

    req := public.send_email(
      u.email,
      case when cnt = 1 then 'Scadenze: 1 avviso' else 'Scadenze: ' || cnt || ' avvisi' end,
      public.email_layout('Buongiorno ' || html_escape(split_part(u.full_name, ' ', 1)) || ',',
        case when cnt = 1 then 'c''è una scadenza da tenere d''occhio:' else 'ci sono ' || cnt || ' scadenze da tenere d''occhio:' end,
        rows, base || '/scadenze', 'Vai alle scadenze'),
      'scadenze');
    -- Senza chiave (o con errore) le notifiche restano da inviare per il giro successivo
    if req is not null then
      update public.notifications set emailed_at = now()
        where user_id = u.id and type = 'scadenza' and emailed_at is null and created_at > now() - interval '24 hours';
      sent := sent + 1;
    end if;
  end loop;
  return sent;
end $$;
revoke execute on function public.send_renewal_digest() from public, anon, authenticated;

-- Email di prova all'utente che la chiede (solo amministratori)
create or replace function public.send_test_email()
returns text language plpgsql security definer set search_path = public as $$
declare
  addr text;
  base text;
  req bigint;
begin
  if not public.has_role(array['admin']::public.app_role[]) then raise exception 'Solo gli amministratori possono inviare email di prova'; end if;
  select email into addr from auth.users where id = auth.uid();
  select rtrim(app_url, '/') into base from public.company_settings where id = 1;
  req := public.send_email(addr, 'Prova avvisi del gestionale',
    public.email_layout('Funziona!', 'Questa è un''email di prova: da ora gli avvisi delle scadenze arriveranno anche qui.', '', base, 'Apri il gestionale'),
    'prova');
  return case when req is null then 'senza_chiave' else 'inviata' end;
end $$;
revoke execute on function public.send_test_email() from public, anon;
grant execute on function public.send_test_email() to authenticated;

-- Stato degli ultimi invii, con la risposta di Resend (solo amministratori)
create or replace function public.email_status()
returns table (created_at timestamptz, to_email text, subject text, kind text, status text, http_status integer, detail text, key_configured boolean)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role(array['admin']::public.app_role[]) then raise exception 'Solo amministratori'; end if;
  return query
    select l.created_at, l.to_email, l.subject, l.kind,
           case when l.status = 'inviata' and r.status_code is not null and r.status_code not between 200 and 299 then 'rifiutata' else l.status end,
           r.status_code,
           coalesce(l.detail, case when r.status_code not between 200 and 299 then left(r.content, 300) end, r.error_msg),
           exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key' and coalesce(decrypted_secret, '') <> '')
    from public.email_log l
    left join net._http_response r on r.id = l.request_id
    order by l.created_at desc
    limit 10;
  if not found then
    return query select null::timestamptz, null::text, null::text, null::text, null::text, null::integer, null::text,
      exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key' and coalesce(decrypted_secret, '') <> '');
  end if;
end $$;
revoke execute on function public.email_status() from public, anon;
grant execute on function public.email_status() to authenticated;

-- Ogni mattina: 07:00 UTC controllo scadenze (già esistente), 07:05 UTC email
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omnira-email-scadenze', '5 7 * * *', 'select public.send_renewal_digest()');
  end if;
end $$;

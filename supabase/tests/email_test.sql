\set ON_ERROR_STOP 1
begin;
-- senza chiave: registrato come senza_chiave
insert into notifications (user_id, type, title, body, link) values ('00000000-0000-0000-0000-000000000001', 'scadenza', 'Scadenza tra 30 giorni', 'dominio <bottega>.it · Bottega Rossi — scadenza 08/12/2026', '/scadenze?aperto=x');
select public.send_renewal_digest() as inviate_senza_chiave;
select status from email_log order by id desc limit 1;
select count(*) as ancora_da_inviare from notifications where emailed_at is null and title = 'Scadenza tra 30 giorni';
-- con chiave
update notifications set emailed_at = now() where created_at < now() - interval '1 hour';
insert into vault.secrets_raw values ('resend_api_key', 're_test');
insert into notifications (user_id, type, title, body, link) values ('00000000-0000-0000-0000-000000000001', 'scadenza', 'Scaduto da 2 giorni', 'hosting VPS · Templana — scadenza 06/11/2026', '/scadenze?aperto=y');
insert into notifications (user_id, type, title, body) values ('00000000-0000-0000-0000-000000000002', 'scadenza', 'Scade oggi', 'ssl X');
update profiles set email_notifications = false where id = '00000000-0000-0000-0000-000000000002';
select public.send_renewal_digest() as inviate;
select body->>'to' as a, body->>'subject' as oggetto, body->>'from' as da, position('&lt;bottega&gt;' in body->>'html') > 0 as html_escapato, position('/scadenze?aperto=y' in body->>'html') > 0 as link_ok, headers->>'Authorization' as auth from net.requests order by id desc limit 1;
select count(*) filter (where emailed_at is null and user_id = '00000000-0000-0000-0000-000000000001') as non_inviate_admin, count(*) filter (where emailed_at is null and user_id = '00000000-0000-0000-0000-000000000002') as non_inviate_disattivato from notifications where type = 'scadenza';
select public.send_renewal_digest() as seconda_volta;
-- prova da admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.send_test_email() as prova;
select status, http_status, key_configured from public.email_status() limit 1;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin perform public.send_test_email(); raise notice 'ERRORE: team ha inviato'; exception when others then raise notice 'ok team bloccato: %', sqlerrm; end $$;
rollback;

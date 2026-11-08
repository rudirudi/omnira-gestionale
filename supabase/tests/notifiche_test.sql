\set ON_ERROR_STOP 1
begin;
delete from vault.secrets_raw; delete from net.requests;
update notifications set delivered_at = now() where delivered_at is null;
-- promemoria scaduto 5 minuti fa, creato da Rudi
insert into activities (type, subject, due_at, client_id, created_by)
  select 'promemoria', 'Chiamare Bottega per rinnovo', now() - interval '5 minutes', id, '00000000-0000-0000-0000-000000000001' from clients limit 1;
insert into activities (type, subject, due_at, client_id, created_by)
  select 'promemoria', 'Futuro', now() + interval '2 days', id, '00000000-0000-0000-0000-000000000001' from clients limit 1;
select public.notify_due_activities() as promemoria_notificati;
select type, title, body like '%·%' as body_ok, link like '/clienti/%' as link_ok from notifications where type = 'promemoria' and delivered_at is null;
select public.notify_due_activities() as seconda_volta;
-- nessuna chiave: email attiva per default → resta da consegnare
select public.deliver_notifications() as consegnate_senza_chiavi;
select count(*) as ancora_in_attesa from notifications where type = 'promemoria' and delivered_at is null;
-- chiavi + Telegram collegato via bot
insert into vault.secrets_raw values ('resend_api_key', 're_x'), ('telegram_bot_token', '123:abc'), ('telegram_webhook_secret', 'segreto');
update profiles set telegram_link_code = 'CODICE1', notification_email = 'avvisi.rudi@omnirasoft.it' where id = '00000000-0000-0000-0000-000000000001';
select public.telegram_link('sbagliato', 'CODICE1', 555, 'rudiv') as segreto_errato;
select public.telegram_link('segreto', 'NOPE', 555, 'rudiv') as codice_errato;
select public.telegram_link('segreto', 'CODICE1', 555, 'rudiv') as collegamento;
select telegram_chat_id, notify_telegram, telegram_link_code from profiles where id = '00000000-0000-0000-0000-000000000001';
delete from net.requests;
select public.deliver_notifications() as consegnate;
select case when url like '%telegram%' then 'telegram' else 'email' end as canale, coalesce(body->>'to', body->>'chat_id') as a, coalesce(body->>'subject', left(body->>'text', 60)) as testo from net.requests order by id;
select count(*) as in_attesa_dopo from notifications where type = 'promemoria' and delivered_at is null;
-- utente non può impostare a mano la chat di un altro
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin update profiles set telegram_chat_id = 555 where id = '00000000-0000-0000-0000-000000000002'; raise notice 'ERRORE: chat impostata a mano';
exception when others then raise notice 'ok: %', sqlerrm; end $$;
select * from public.notification_channels();
select public.send_test_telegram() as prova_tg_team;
rollback;

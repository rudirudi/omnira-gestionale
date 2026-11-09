\set ON_ERROR_STOP 1
-- Chat: permessi, conversazioni dirette, non letti, avvisi. Tutto in una transazione annullata.
begin;
-- Rudi apre la chat con Shkelzen (due volte: stessa conversazione)
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select public.chat_open_direct('22222222-2222-2222-2222-222222222222') = public.chat_open_direct('22222222-2222-2222-2222-222222222222') as stessa_conversazione;
do $$ begin perform public.chat_open_direct('11111111-1111-1111-1111-111111111111'); raise exception 'ERRORE: chat con sé stessi'; exception when others then if sqlerrm like 'ERRORE%' then raise; end if; end $$;
do $$ begin perform public.chat_open_direct('44444444-4444-4444-4444-444444444444'); raise exception 'ERRORE: chat con utente non attivo'; exception when others then if sqlerrm like 'ERRORE%' then raise; end if; end $$;
insert into chat_messages (conversation_id, body)
  select public.chat_open_direct('22222222-2222-2222-2222-222222222222'), 'Ciao, guardi P-2026-026-4?';
select set_config('chat.diretta', public.chat_open_direct('22222222-2222-2222-2222-222222222222')::text, true) is not null as salvata;
insert into chat_messages (conversation_id, body)
  select id, 'Buongiorno a tutti' from chat_conversations where slug = 'generale';
select kind, name, other_name, last_body, unread from public.chat_overview();

-- Luca non vede la chat privata Rudi–Shkelzen, vede solo il Generale
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select count(*) as messaggi_visti_da_luca from chat_messages;
select kind, unread from public.chat_overview();
do $$ begin
  insert into chat_messages (conversation_id, body) values (current_setting('chat.diretta')::uuid, 'intruso');
  raise exception 'ERRORE: Luca scrive in una chat non sua';
exception when insufficient_privilege or check_violation then null; end $$;
do $$ begin
  update chat_messages set body = 'modificato da Luca' where body = 'Buongiorno a tutti';
  if found then raise exception 'ERRORE: Luca modifica un messaggio di Rudi'; end if;
end $$;

-- Shkelzen: 2 non letti, poi legge
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select public.chat_unread_total() as non_letti_shkelzen;
reset role;
-- simula messaggi vecchi di 10 minuti → avviso
set local session_replication_role = replica;
update chat_messages set created_at = now() - interval '10 minutes';
update chat_members set last_read_at = now() - interval '1 hour';
set local session_replication_role = origin;
select public.chat_notify_unread() as avvisi_creati;
select public.chat_notify_unread() as avvisi_ripetuti;
select user_id = '22222222-2222-2222-2222-222222222222' as a_shkelzen, title, body, link like '/chat?c=%' as link_ok
  from notifications where type = 'messaggio' order by user_id, title;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select public.chat_mark_read(conversation_id) from chat_messages where body like 'Ciao%';
select public.chat_unread_total() as non_letti_dopo_lettura;
reset role;
select count(*) filter (where read_at is null) as notifiche_chat_non_lette_shkelzen from notifications
  where type = 'messaggio' and user_id = '22222222-2222-2222-2222-222222222222' and link not like '%' || (select id from chat_conversations where slug = 'generale');

-- Rudi modifica e cancella il proprio messaggio
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
update chat_messages set body = 'Buongiorno a tutti!' where body = 'Buongiorno a tutti';
select body, edited_at is not null as modificato from chat_messages where body like 'Buongiorno%';
update chat_messages set deleted_at = now() where body = 'Buongiorno a tutti!';
select body, deleted_at is not null as eliminato from chat_messages where deleted_at is not null;
rollback;

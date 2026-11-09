\set ON_ERROR_STOP 1
begin;
delete from notifications;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into discussions (kind, title, body, owner_id, priority)
  values ('punto', 'Scegliere il fornitore hosting', 'Aruba o Hetzner?', '22222222-2222-2222-2222-222222222222', 'alta');
select number > 0 as numerato, status, created_by = '11111111-1111-1111-1111-111111111111' as autore_ok from discussions where title like 'Scegliere%';
reset role;
select user_id, title, body from notifications order by user_id;
delete from notifications;
-- Shkelzen risponde: avvisato Rudi (autore)
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
insert into comments (entity_type, entity_id, body, author_id)
  select 'discussion', id, 'Io direi Hetzner', '22222222-2222-2222-2222-222222222222' from discussions where title like 'Scegliere%';
select replies_count from discussions where title like 'Scegliere%';
-- Shkelzen risolve con esito
update discussions set status = 'risolto', resolution = 'Hetzner, costa meno' where title like 'Scegliere%';
select status, resolved_by = '22222222-2222-2222-2222-222222222222' as risolto_da_shk, resolved_at is not null as data from discussions where title like 'Scegliere%';
-- non può eliminare un punto aperto da Rudi
do $$ begin update discussions set deleted_at = now() where title like 'Scegliere%'; raise exception 'ERRORE: eliminato da non autore'; exception when others then if sqlerrm like 'ERRORE%' then raise; end if; end $$;
-- riapre
update discussions set status = 'aperto' where title like 'Scegliere%';
select status, resolved_at is null as azzerato from discussions where title like 'Scegliere%';
reset role;
select user_id, type, title, body from notifications order by created_at;
rollback;

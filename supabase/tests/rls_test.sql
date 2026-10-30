-- Test delle policy RLS. Ogni blocco simula un utente diverso.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'rudi@omnirasoft.it', '{"full_name":"Rudi Veshti"}'),
  ('00000000-0000-0000-0000-000000000002', 'dev@omnirasoft.it', '{"full_name":"Sviluppatore Test"}'),
  ('00000000-0000-0000-0000-000000000003', 'ex@omnirasoft.it', '{}');

select id, full_name, role from public.profiles order by email;

-- Admin: imposta ruoli e disattiva l'ex collaboratore
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
update public.profiles set active = false where email = 'ex@omnirasoft.it';
insert into public.clients (name, vat_number, city) values ('Templana Srl', '01234567890', 'Terni');
insert into public.leads (title, company_name, source, estimated_value_cents) values ('Sito e-commerce', 'Bottega Rossi', 'chatbot', 199900);
insert into public.activities (type, subject, client_id) select 'nota', 'Prima call', id from public.clients limit 1;
select count(*) as clienti_visti_admin from public.clients;

-- Team: legge ma non crea clienti, non si promuove admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select count(*) as clienti_visti_team from public.clients;
do $$ begin
  begin
    insert into public.clients (name) values ('Non permesso');
    raise exception 'FALLITO: team ha creato un cliente';
  exception when insufficient_privilege then raise notice 'OK: team non crea clienti';
  end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FALLITO: team si è promosso admin';
  exception when raise_exception then
    if sqlerrm like 'FALLITO%' then raise; end if;
    raise notice 'OK: team non cambia il proprio ruolo';
  end;
end $$;
insert into public.activities (type, subject, client_id) select 'chiamata', 'Chiamata del team', id from public.clients limit 1;
select count(*) as audit_visto_team from public.audit_log;

-- Utente disattivato: non vede nulla
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select count(*) as clienti_visti_disattivato from public.clients;

-- Anonimo: nessun accesso
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select count(*) as clienti_visti_anon from public.clients;
reset role;

-- Lead perso senza motivo → vincolo
do $$ begin
  begin
    update public.leads set stage = 'perso';
    raise exception 'FALLITO: perso senza motivo accettato';
  exception when check_violation then raise notice 'OK: motivo obbligatorio per lead perso';
  end;
end $$;
update public.leads set stage = 'vinto';
select stage, closed_at is not null as chiuso from public.leads;
select table_name, action, count(*) from public.audit_log group by 1,2 order by 1,2;

-- Test delle policy RLS. Ogni blocco simula un utente diverso.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'rudi@omnirasoft.it', '{"full_name":"Rudi Veshti"}'),
  ('00000000-0000-0000-0000-000000000002', 'dev@omnirasoft.it', '{"full_name":"Sviluppatore Test"}'),
  ('00000000-0000-0000-0000-000000000003', 'ex@omnirasoft.it', '{}');

select id, full_name, role, active from public.profiles order by email;
-- attivazione da SQL editor (auth.uid() nullo)
update public.profiles set active = true where email = 'dev@omnirasoft.it';

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

-- ===================== Fase 1: progetti, task, commenti =====================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into public.projects (name, client_id, type, manager_id)
  select 'Gestionale Templana', id, 'gestionale', '00000000-0000-0000-0000-000000000001' from public.clients limit 1;
select code, (select count(*) from public.project_phases ph where ph.project_id = p.id) as fasi from public.projects p;
insert into public.tasks (project_id, title) select id, 'Analisi requisiti' from public.projects;
insert into public.tasks (project_id, title, status) select id, 'Setup repo', 'fatto' from public.projects;
insert into public.task_assignees (task_id, user_id)
  select id, '00000000-0000-0000-0000-000000000002' from public.tasks where number = 1;
select number, title, completed_at is not null as completato from public.tasks order by number;

-- team: crea task, aggiorna stato, commenta con menzione; non crea progetti
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select count(*) as notifiche_dev from public.notifications;
update public.tasks set status = 'in_corso' where number = 1;
insert into public.comments (entity_type, entity_id, body, mentions)
  select 'task', id, 'Fatto il primo giro, @Rudi controlli?', array['00000000-0000-0000-0000-000000000001'::uuid] from public.tasks where number = 1;
do $$ begin
  begin
    insert into public.projects (name) values ('Non permesso');
    raise exception 'FALLITO: team ha creato un progetto';
  exception when insufficient_privilege then raise notice 'OK: team non crea progetti';
  end;
end $$;
select count(*) as notifiche_viste_da_dev_di_altri from public.notifications where user_id <> auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select type, title, body, link from public.notifications;
select * from public.project_progress;
reset role;

\set ON_ERROR_STOP 1
begin;
set role authenticated;
-- admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
-- Claude mensile dal 31 gennaio: deve creare gen31, feb28, mar31 ... ott31 = 10 addebiti
insert into expense_subscriptions (name, supplier, amount_cents, frequency, start_date) values ('Claude Max', 'Anthropic', 9000, 'mensile', '2026-01-31');
select spent_on, amount_cents from expenses where description='Claude Max' order by spent_on;
select charges_count, next_charge_date, active from expense_subscriptions where name='Claude Max';
-- annuale futuro: nessun addebito
insert into expense_subscriptions (name, amount_cents, frequency, start_date) values ('Lovable', 25000, 'annuale', current_date + 10);
select count(*) as lovable_spese from expenses where description='Lovable';
-- disdetto: dal 2026-08-15 al 2026-09-20 mensile = 2 addebiti, inattivo
insert into expense_subscriptions (name, amount_cents, frequency, start_date, end_date) values ('Figma', 1500, 'mensile', '2026-08-15', '2026-09-20');
select count(*) figma, bool_or(s.active) attivo from expenses e join expense_subscriptions s on s.id=e.subscription_id where s.name='Figma';
-- generazione ripetuta non duplica
reset role;
select public.generate_subscription_expenses() as nuove;
set role authenticated;
-- utente team: vede solo le sue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select count(*) as team_vede from expenses;
insert into expenses (description, amount_cents, paid_with) values ('Treno Roma', 4500, 'personale');
select count(*) as team_vede_dopo from expenses;
do $$ begin
  begin insert into expenses (description, amount_cents, paid_by) values ('altrui', 100, '00000000-0000-0000-0000-000000000001'); raise notice 'ERRORE: inserita spesa altrui';
  exception when others then raise notice 'ok: team non registra spese altrui'; end;
end $$;
rollback;

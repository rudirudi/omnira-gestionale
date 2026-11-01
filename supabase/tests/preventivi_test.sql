\set ON_ERROR_STOP 1
begin;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into leads (title, company_name, stage) values ('Sito Pasticceria', 'Pasticceria Test', 'analisi');
insert into clients (name) values ('Pasticceria Test');
-- preventivo da lead: numero automatico
insert into quotes (title, lead_id, client_id, vat_rate, discount_cents, deposit_pct)
  select 'Sito vetrina', l.id, c.id, 22, 10000, 30 from leads l, clients c where l.title='Sito Pasticceria' and c.name='Pasticceria Test';
select number, status from quotes where title='Sito vetrina';
insert into quote_items (quote_id, position, description, quantity, unit, unit_price_cents)
  select id, 0, 'Sviluppo sito 5 pagine', 1, 'pz', 150000 from quotes where title='Sito vetrina';
insert into quote_items (quote_id, position, description, quantity, unit, unit_price_cents)
  select id, 1, 'Formazione', 4, 'ore', 5000 from quotes where title='Sito vetrina';
insert into quote_items (quote_id, position, description, quantity, unit, unit_price_cents, frequency)
  select id, 2, 'Hosting e manutenzione', 1, 'anno', 20000, 'annuale' from quotes where title='Sito vetrina';
-- imponibile una tantum 1500+200-100 = 1600; IVA 22% = 1952; acconto 30% = 585,60
select accept_quote(id, true, 'sito') is not null as progetto_creato from quotes where title='Sito vetrina';
select status, project_id is not null as ha_progetto from quotes where title='Sito vetrina';
select description, amount_cents from receivables where notes like 'Preventivo PRV-%' order by amount_cents;
select name, frequency, price_cents from renewals where notes like 'Da preventivo%';
select stage from leads where title='Sito Pasticceria';
select name, budget_cents from projects where name='Sito vetrina';
-- non si accetta due volte
do $$ begin perform accept_quote((select id from quotes where title='Sito vetrina')); raise notice 'ERRORE: doppia accettazione';
exception when others then raise notice 'ok: %', sqlerrm; end $$;
-- team non vede i preventivi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select count(*) as team_vede from quotes;
rollback;

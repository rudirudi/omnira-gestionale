-- Test locale del flusso fatture (risposte di Invoicetronic simulate)
begin;
select vault.create_secret('ik_test_fake', 'invoicetronic_api_key');
update company_settings set vat_number = '01234567890', tax_code = '01234567890', invoicing_mode = 'prova' where id = 1;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into invoices (client_id, date, causale) values ((select id from clients where deleted_at is null limit 1), current_date, 'Test') returning id \gset
select test, status from invoices where id = :'id';
insert into invoice_lines (invoice_id, description, quantity, unit_price_cents, vat_rate, vat_nature) values (:'id', 'Sviluppo', 2, 50000, 22, null), (:'id', 'Spese anticipate', 1, 200, 0, 'N1');
\echo 'expected error: nature missing'
savepoint a; insert into invoice_lines (invoice_id, description, unit_price_cents, vat_rate) values (:'id', 'x', 100, 0); rollback to a;

select net_cents, vat_cents, total_cents from invoices where id = :'id';
\echo 'expected error: system field'
savepoint b; update invoices set status = 'inviata' where id = :'id'; rollback to b;
select invoice_assign_number(:'id') as numero;
select invoice_assign_number(:'id') as numero_stesso;
reset role;
insert into net.fake_responses values ('https://api.invoicetronic.com/v1/send', 201, '{"id": 777, "identifier": null, "file_name": "IT01234567890_00001.xml"}') on conflict (url_like) do update set status_code = excluded.status_code, content = excluded.content;
set local role authenticated;
select invoice_submit(:'id', '<xml/>', 'IT01234567890_00001.xml', '{"name":"x"}');
\echo 'expected error: locked lines'
savepoint c; update invoice_lines set description = 'y' where invoice_id = :'id'; rollback to c;
reset role;
select (select headers ->> 'Authorization' from net.requests order by id desc limit 1) like 'Basic %' as auth_ok, (select params from net.requests order by id desc limit 1), (select convert_from(decode(body->>'payload','base64'),'UTF8') from net.requests order by id desc limit 1) as payload;
set local role authenticated;
select invoicing_sync();
select status, itx_send_id, file_name from invoices where id = :'id';
reset role;
insert into net.fake_responses values ('https://api.invoicetronic.com/v1/update', 200, '[{"id":1,"send_id":777,"state":"Scartato","description":"00305 IdFiscale del cessionario non valido","last_update":"2026-11-16T10:00:00Z","errors":[{"code":"00305","description":"IdFiscale non valido"}]}]'),
  ('https://api.invoicetronic.com/v1/receive', 200, '[{"id":55,"identifier":"999","file_name":"IT09876543210_abc.xml","prestatore":"IT09876543210","nome_prestatore":"Fornitore Srl","documents":[{"number":"F12","date":"2026-11-10T00:00:00"}],"payload":"PGEvPg==","encoding":"Base64","date_sent":"2026-11-10T08:00:00Z","last_update":"2026-11-10T08:00:00Z"}]')
on conflict (url_like) do update set status_code = excluded.status_code, content = excluded.content;
set local role authenticated;
select invoicing_sync() as giro1;
select invoicing_sync() as giro2;
select status, sdi_state, sdi_message, sdi_errors from invoices where id = :'id';
select supplier_name, number, doc_date from purchase_invoices;
update invoice_lines set description = 'Sviluppo corretto' where invoice_id = :'id' and vat_rate = 22;
select count(*) as notifiche from notifications where type = 'fattura';
\echo 'expected error: delete numbered'
savepoint d; delete from invoices where id = :'id'; rollback to d;
select invoicing_sync() as giro3_duplicati;
select count(*) from purchase_invoices;
rollback;

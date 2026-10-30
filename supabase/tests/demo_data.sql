-- Dati dimostrativi per sviluppo/test locale (NON usare in produzione).
-- Presuppone che esistano già almeno 3 profili (creati dal primo accesso degli utenti).
with team as (
  select id, row_number() over (order by created_at, email) as n from public.profiles
)
insert into public.clients (name, legal_name, vat_number, sdi_code, email, phone, city, province, sector, status, owner_id)
select v.name, v.legal, v.vat, v.sdi, v.email, v.phone, v.city, v.prov, v.sector, v.status::public.client_status,
       (select id from team where n = v.owner)
from (values
  ('Templana', 'Templana S.r.l.', '01234567890', 'M5UXCR1', 'info@templana.example', '0744 123456', 'Terni', 'TR', 'Servizi operativi', 'attivo', 1),
  ('Bottega Rossi', 'Bottega Rossi di Mario Rossi', '09876543210', null, 'ordini@bottegarossi.example', '0984 765432', 'Cosenza', 'CS', 'Commercio', 'attivo', 2),
  ('Studio Legale Bianchi', 'Studio Legale Bianchi Associati', '11223344556', 'KRRH6B9', 'segreteria@studiobianchi.example', null, 'Roma', 'RM', 'Studio legale', 'attivo', 1),
  ('Officine Verdi', 'Officine Verdi S.p.A.', '66554433221', null, null, '0744 998877', 'Narni', 'TR', 'Manifattura', 'prospect', 2),
  ('Agriturismo La Sila', null, null, null, 'info@lasila.example', null, 'Longobucco', 'CS', 'Turismo', 'inattivo', 3)
) as v(name, legal, vat, sdi, email, phone, city, prov, sector, status, owner);

insert into public.contacts (client_id, first_name, last_name, job_title, email, phone, is_primary)
select c.id, v.fn, v.ln, v.role, v.email, v.phone, v.prim
from (values
  ('Templana', 'Giulia', 'Neri', 'Direttrice operativa', 'giulia.neri@templana.example', '333 1112233', true),
  ('Templana', 'Marco', 'Galli', 'Responsabile IT', 'marco.galli@templana.example', null, false),
  ('Bottega Rossi', 'Mario', 'Rossi', 'Titolare', 'mario@bottegarossi.example', '347 4455667', true)
) as v(client, fn, ln, role, email, phone, prim)
join public.clients c on c.name = v.client;

with team as (select id, row_number() over (order by created_at, email) as n from public.profiles)
insert into public.leads (title, company_name, contact_name, email, source, stage, service_interest, estimated_value_cents, expected_close_date, position, owner_id, lost_reason)
select v.title, v.company, v.contact, v.email, v.source::public.lead_source, v.stage::public.lead_stage, v.service,
       v.value, (current_date + v.days), v.pos, (select id from team where n = v.owner), v.lost
from (values
  ('Sito vetrina + SEO', 'Pasticceria Dolce Terni', 'Anna Ferri', 'anna@dolceterni.example', 'chatbot', 'nuovo', 'Sito web / landing page', 99900, 20, 1, 2, null),
  ('Chatbot WhatsApp per prenotazioni', 'Hotel Belvedere', 'Luca Conti', null, 'whatsapp', 'nuovo', 'AI Chat', 199900, 30, 2, 1, null),
  ('Gestionale magazzino', 'Officine Verdi', 'Paolo Verdi', 'paolo@officineverdi.example', 'referral', 'call', 'Gestionale (Software Omnira)', 1450000, 45, 1, 1, null),
  ('Assistente vocale centralino', 'Studio Medico Salus', 'Dott.ssa Sara Leone', null, 'form', 'analisi', 'AI Voice', 299900, 25, 1, 2, null),
  ('E-commerce Shopify', 'Bottega Rossi', 'Mario Rossi', 'mario@bottegarossi.example', 'sito', 'preventivo', 'E-commerce', 199900, 10, 1, 2, null),
  ('App prenotazioni campi', 'Padel Club Narni', 'Elisa Moro', null, 'social', 'preventivo', 'App mobile', 850000, 15, 2, 1, null),
  ('Automazione fatture fornitori', 'Templana', 'Giulia Neri', 'giulia.neri@templana.example', 'referral', 'vinto', 'Automazione AI', 600000, -5, 1, 1, null),
  ('Restyling sito', 'Ristorante Il Borgo', 'Gino Sala', null, 'evento', 'perso', 'Sito web / landing page', 99900, -12, 1, 3, 'Budget rimandato al 2027')
) as v(title, company, contact, email, source, stage, service, value, days, pos, owner, lost);

update public.leads set client_id = (select id from public.clients where name = 'Templana') where company_name = 'Templana';

insert into public.activities (type, subject, body, due_at, client_id, created_by)
select v.type::public.activity_type, v.subject, v.body, case when v.due is null then null else now() + (v.due || ' hours')::interval end,
       c.id, (select id from public.profiles order by created_at, email limit 1)
from (values
  ('Templana', 'riunione', 'Demo dashboard pianificazione', 'Mostrata la nuova vista settimanale. Giulia chiede export Excel.', null),
  ('Templana', 'promemoria', 'Inviare preventivo modulo export', null, '26'),
  ('Bottega Rossi', 'chiamata', 'Richiamare per catalogo prodotti', 'Mario invia le foto entro venerdì.', '-20'),
  ('Studio Legale Bianchi', 'promemoria', 'Rinnovo manutenzione sito', null, '96')
) as v(client, type, subject, body, due)
join public.clients c on c.name = v.client;

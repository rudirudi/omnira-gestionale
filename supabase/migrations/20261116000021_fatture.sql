-- Fatture elettroniche: emesse (verso i clienti) e ricevute (dai fornitori), tramite Invoicetronic.
-- La chiave API sta nel Vault ('invoicetronic_api_key'): l'app non la vede mai, le chiamate partono dal database (pg_net).
-- Modalità 'prova' (chiave di test, numerazione separata) e 'reale'.

-- ---------------------------------------------------------------------------
-- Dati fiscali dell'azienda
-- ---------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists tax_regime text not null default 'RF01',
  add column if not exists zip text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists country text not null default 'IT',
  add column if not exists rea_office text,
  add column if not exists rea_number text,
  add column if not exists invoicing_mode text not null default 'prova' check (invoicing_mode in ('prova', 'reale')),
  add column if not exists invoice_last_external_year integer,
  add column if not exists invoice_last_external_number integer,
  add column if not exists invoicing_status jsonb,
  add column if not exists invoicing_checked_at timestamptz;

-- ---------------------------------------------------------------------------
-- Fatture emesse
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  test boolean not null default false,
  doc_type text not null default 'TD01' check (doc_type in ('TD01', 'TD02', 'TD04', 'TD06')),
  year integer,
  number integer,
  date date not null default current_date,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  related_invoice_id uuid references public.invoices (id) on delete set null,
  customer jsonb,
  causale text check (causale is null or char_length(causale) <= 2000),
  notes text,
  payment_method text not null default 'MP05',
  payment_due date,
  iban text,
  net_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  status text not null default 'bozza'
    check (status in ('bozza', 'in_invio', 'inviata', 'consegnata', 'non_consegnata', 'scartata', 'errore')),
  xml text,
  file_name text,
  request_id bigint,
  attempts integer not null default 0,
  itx_send_id bigint,
  sdi_identifier text,
  sdi_state text,
  sdi_message text,
  sdi_errors jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  last_sdi_update timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((year is null) = (number is null))
);
create unique index invoices_number_unique on public.invoices (test, year, number) where number is not null;
create index invoices_client_idx on public.invoices (client_id) where deleted_at is null;
create index invoices_project_idx on public.invoices (project_id) where deleted_at is null;
create index invoices_status_idx on public.invoices (status) where deleted_at is null;
create index invoices_send_idx on public.invoices (itx_send_id) where itx_send_id is not null;

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null default 0,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null,
  vat_rate numeric(5, 2) not null default 22 check (vat_rate >= 0 and vat_rate < 100),
  vat_nature text check (vat_nature is null or vat_nature ~ '^N[1-7](\.[0-9])?$'),
  receivable_id uuid references public.receivables (id) on delete set null,
  check (vat_rate > 0 or vat_nature is not null)
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);
create index invoice_lines_receivable_idx on public.invoice_lines (receivable_id) where receivable_id is not null;

-- Totali sempre allineati alle righe (IVA arrotondata per aliquota, come nel riepilogo dell'XML)
create or replace function public.invoice_recalc(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n bigint; v bigint;
begin
  select coalesce(sum(net), 0), coalesce(sum(round(net * rate / 100.0)), 0) into n, v
  from (
    select vat_rate as rate, sum(round(quantity * unit_price_cents)) as net
    from public.invoice_lines where invoice_id = p_invoice group by vat_rate, vat_nature
  ) s;
  update public.invoices set net_cents = n, vat_cents = v, total_cents = n + v where id = p_invoice
    and (net_cents, vat_cents, total_cents) is distinct from (n, v, n + v);
end $$;
revoke execute on function public.invoice_recalc(uuid) from public, anon, authenticated;

create or replace function public.invoice_lines_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.invoice_recalc(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
create trigger invoice_lines_after after insert or update or delete on public.invoice_lines
  for each row execute function public.invoice_lines_after();

-- Una fattura inviata non si modifica più (si può correggere solo se scartata o in errore)
create or replace function public.invoice_editable(p_invoice uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status in ('bozza', 'scartata', 'errore') and deleted_at is null from public.invoices where id = p_invoice), false)
$$;
revoke execute on function public.invoice_editable(uuid) from public, anon;
grant execute on function public.invoice_editable(uuid) to authenticated;

create or replace function public.invoice_lines_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('omnira.invoicing', true) = 'on' then return coalesce(new, old); end if;
  if not public.invoice_editable(coalesce(new.invoice_id, old.invoice_id)) then
    raise exception 'La fattura è già stata inviata: non si può modificare' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines
  for each row execute function public.invoice_lines_guard();

create or replace function public.invoices_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- le funzioni di invio/sincronizzazione impostano questo flag
  if current_setting('omnira.invoicing', true) = 'on' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.number is not null then
      raise exception 'Una fattura numerata non si può eliminare' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    -- campi gestiti solo dal sistema
    if (new.status, new.number, new.year, new.test, new.xml, new.request_id, new.itx_send_id, new.sdi_identifier, new.sdi_state, new.sent_at, new.delivered_at, new.attempts)
       is distinct from (old.status, old.number, old.year, old.test, old.xml, old.request_id, old.itx_send_id, old.sdi_identifier, old.sdi_state, old.sent_at, old.delivered_at, old.attempts) then
      raise exception 'Campo gestito dal sistema' using errcode = '42501';
    end if;
    if old.status not in ('bozza', 'scartata', 'errore') and (
      (new.doc_type, new.date, new.client_id, new.causale, new.payment_method, new.payment_due, new.iban, new.related_invoice_id, new.deleted_at)
      is distinct from (old.doc_type, old.date, old.client_id, old.causale, old.payment_method, old.payment_due, old.iban, old.related_invoice_id, old.deleted_at)
    ) then
      raise exception 'La fattura è già stata inviata: non si può modificare' using errcode = '42501';
    end if;
    if new.deleted_at is not null and old.deleted_at is null and old.number is not null then
      raise exception 'Una fattura numerata non si può eliminare' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'bozza'; new.number := null; new.year := null; new.xml := null; new.request_id := null;
    new.itx_send_id := null; new.sdi_identifier := null; new.sdi_state := null; new.sent_at := null; new.delivered_at := null; new.attempts := 0;
    new.test := coalesce((select invoicing_mode = 'prova' from public.company_settings where id = 1), true);
  end if;
  return new;
end $$;
create trigger invoices_guard before insert or update or delete on public.invoices
  for each row execute function public.invoices_guard();

create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function public.audit_row();
create trigger invoice_lines_audit after insert or update or delete on public.invoice_lines for each row execute function public.audit_row();

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
create policy invoices_read on public.invoices for select to authenticated using ((select public.can_view_money()));
create policy invoices_insert on public.invoices for insert to authenticated with check ((select public.can_manage_money()));
create policy invoices_update on public.invoices for update to authenticated using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
create policy invoices_delete on public.invoices for delete to authenticated using ((select public.can_manage_money()));
create policy invoice_lines_read on public.invoice_lines for select to authenticated using ((select public.can_view_money()));
create policy invoice_lines_write on public.invoice_lines for all to authenticated using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
grant select, insert, update, delete on public.invoices, public.invoice_lines to authenticated;

-- ---------------------------------------------------------------------------
-- Fatture ricevute dai fornitori
-- ---------------------------------------------------------------------------
create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  test boolean not null default false,
  itx_receive_id bigint unique,
  sdi_identifier text,
  file_name text,
  supplier_vat text,
  supplier_name text,
  number text,
  doc_date date,
  doc_type text,
  net_cents bigint,
  vat_cents bigint,
  total_cents bigint,
  due_date date,
  description text,
  payload text,
  encoding text,
  received_at timestamptz,
  parsed_at timestamptz,
  status text not null default 'da_registrare' check (status in ('da_registrare', 'registrata', 'pagata', 'ignorata')),
  expense_id uuid references public.expenses (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  notes text,
  source text not null default 'sdi' check (source in ('sdi', 'importata')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_invoices_date_idx on public.purchase_invoices (doc_date desc);
create unique index purchase_invoices_doc_unique on public.purchase_invoices (supplier_vat, number, doc_date) where supplier_vat is not null and number is not null;
create trigger purchase_invoices_updated_at before update on public.purchase_invoices for each row execute function public.set_updated_at();

alter table public.purchase_invoices enable row level security;
create policy purchase_invoices_read on public.purchase_invoices for select to authenticated using ((select public.can_view_money()));
create policy purchase_invoices_write on public.purchase_invoices for all to authenticated using ((select public.can_manage_money())) with check ((select public.can_manage_money()));
grant select, insert, update, delete on public.purchase_invoices to authenticated;

-- ---------------------------------------------------------------------------
-- Collegamento a Invoicetronic
-- ---------------------------------------------------------------------------
create table public.invoicing_requests (
  request_id bigint primary key,
  kind text not null check (kind in ('update', 'receive', 'status', 'company')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  result text
);
alter table public.invoicing_requests enable row level security; -- nessuna policy: solo funzioni di sistema

create table public.invoicing_cursor (
  kind text primary key check (kind in ('update', 'receive')),
  last_update timestamptz not null default '2020-01-01'
);
alter table public.invoicing_cursor enable row level security;
insert into public.invoicing_cursor (kind) values ('update'), ('receive') on conflict do nothing;

create or replace function public.invoicing_auth()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'invoicetronic_api_key' limit 1;
  if k is null or btrim(k) = '' then return null; end if;
  return jsonb_build_object('Authorization', 'Basic ' || replace(encode(convert_to(btrim(k) || ':', 'UTF8'), 'base64'), E'\n', ''), 'Accept', 'application/json', 'Accept-Language', 'it');
end $$;
revoke execute on function public.invoicing_auth() from public, anon, authenticated;

create or replace function public.invoicing_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select public.invoicing_auth() is not null
$$;
revoke execute on function public.invoicing_ready() from public, anon;
grant execute on function public.invoicing_ready() to authenticated;

-- Assegna il numero (progressivo per anno, separato per le prove). Va chiamato prima di generare l'XML.
create or replace function public.invoice_assign_number(p_invoice uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare inv record; n integer; s record;
begin
  if not public.can_manage_money() then raise exception 'Permesso negato' using errcode = '42501'; end if;
  select * into inv from public.invoices where id = p_invoice and deleted_at is null for update;
  if inv.id is null then raise exception 'Fattura non trovata'; end if;
  if inv.number is not null then return inv.number; end if;
  if inv.status <> 'bozza' then raise exception 'Fattura non in bozza'; end if;
  perform pg_advisory_xact_lock(hashtext('omnira-invoice-number'), extract(year from inv.date)::int);
  select * into s from public.company_settings where id = 1;
  select coalesce(max(number), 0) into n from public.invoices where test = inv.test and year = extract(year from inv.date)::int;
  if not inv.test and s.invoice_last_external_year = extract(year from inv.date)::int then
    n := greatest(n, coalesce(s.invoice_last_external_number, 0));
  end if;
  -- la data non può essere precedente all'ultima fattura dello stesso anno
  if exists (select 1 from public.invoices where test = inv.test and year = extract(year from inv.date)::int and date > inv.date) then
    raise exception 'Esiste già una fattura con data successiva: usa una data uguale o più recente';
  end if;
  perform set_config('omnira.invoicing', 'on', true);
  update public.invoices set number = n + 1, year = extract(year from inv.date)::int where id = p_invoice;
  perform set_config('omnira.invoicing', 'off', true);
  return n + 1;
end $$;
revoke execute on function public.invoice_assign_number(uuid) from public, anon;
grant execute on function public.invoice_assign_number(uuid) to authenticated;

-- Invia l'XML a Invoicetronic (validazione inclusa). La risposta arriva in modo asincrono: la legge invoicing_sync().
create or replace function public.invoice_submit(p_invoice uuid, p_xml text, p_file_name text, p_customer jsonb)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare inv record; auth jsonb; req bigint;
begin
  if not public.can_manage_money() then raise exception 'Permesso negato' using errcode = '42501'; end if;
  select * into inv from public.invoices where id = p_invoice and deleted_at is null for update;
  if inv.id is null then raise exception 'Fattura non trovata'; end if;
  if inv.status not in ('bozza', 'scartata', 'errore') then raise exception 'Fattura già inviata'; end if;
  if inv.number is null then raise exception 'Numero non assegnato'; end if;
  if inv.test <> coalesce((select invoicing_mode = 'prova' from public.company_settings where id = 1), true) then
    raise exception 'La fattura è stata creata in un''altra modalità (prova/reale): duplicala per inviarla';
  end if;
  auth := public.invoicing_auth();
  if auth is null then raise exception 'Invoicetronic non è ancora collegato (manca la chiave nel Vault)'; end if;
  select net.http_post(
    url := 'https://api.invoicetronic.com/v1/send',
    body := jsonb_build_object(
      'file_name', p_file_name,
      'payload', replace(encode(convert_to(p_xml, 'UTF8'), 'base64'), E'\n', ''),
      'encoding', 'Base64',
      'meta_data', jsonb_build_object('omnira_invoice', p_invoice)
    ),
    params := '{"validate": "true"}'::jsonb,
    headers := auth || jsonb_build_object('Content-Type', 'application/json', 'Idempotency-Key', p_invoice::text || '-' || (inv.attempts + 1)),
    timeout_milliseconds := 30000
  ) into req;
  perform set_config('omnira.invoicing', 'on', true);
  update public.invoices
     set status = 'in_invio', xml = p_xml, file_name = p_file_name, customer = p_customer, request_id = req,
         attempts = attempts + 1, sdi_message = null, sdi_errors = null, sdi_state = null
   where id = p_invoice;
  perform set_config('omnira.invoicing', 'off', true);
  return 'ok';
end $$;
revoke execute on function public.invoice_submit(uuid, text, text, jsonb) from public, anon;
grant execute on function public.invoice_submit(uuid, text, text, jsonb) to authenticated;

create or replace function public.invoicing_state_status(s text)
returns text language sql immutable as $$
  select case s
    when 'Inviato' then 'inviata'
    when 'Consegnato' then 'consegnata'
    when 'AccettatoDalDestinatario' then 'consegnata'
    when 'DecorrenzaTermini' then 'consegnata'
    when 'AttestazioneTrasmissioneFattura' then 'consegnata'
    -- non recapitata al sistema del cliente ma disponibile nel suo cassetto fiscale: la fattura è emessa
    when 'ImpossibilitaDiRecapito' then 'consegnata'
    when 'NonConsegnato' then 'non_consegnata'
    when 'RifiutatoDalDestinatario' then 'non_consegnata'
    when 'Scartato' then 'scartata'
    else null end
$$;

create or replace function public.invoicing_notify(p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'fattura', p_title, p_body, p_link
  from public.profiles p where p.active and p.role in ('admin', 'amministrazione')
$$;
revoke execute on function public.invoicing_notify(text, text, text) from public, anon, authenticated;

-- Legge le risposte arrivate e chiede le novità (stati SDI e fatture ricevute). Gira ogni 10 minuti e su richiesta.
create or replace function public.invoicing_sync()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  auth jsonb; r record; resp record; js jsonb; it jsonb; inv record; st text; cur timestamptz; mx timestamptz;
  n_sent int := 0; n_upd int := 0; n_recv int := 0; mode_test boolean;
begin
  if auth.uid() is not null and not public.can_manage_money() then raise exception 'Permesso negato' using errcode = '42501'; end if;
  perform set_config('omnira.invoicing', 'on', true);
  select invoicing_mode = 'prova' into mode_test from public.company_settings where id = 1;

  -- 1) esito degli invii
  for inv in select * from public.invoices where status = 'in_invio' and request_id is not null for update skip locked loop
    select * into resp from net._http_response where id = inv.request_id;
    if resp.id is null then
      if inv.updated_at < now() - interval '15 minutes' then
        update public.invoices set status = 'errore', sdi_message = 'Nessuna risposta da Invoicetronic: riprova' where id = inv.id;
      end if;
      continue;
    end if;
    begin js := resp.content::jsonb; exception when others then js := null; end;
    if resp.status_code between 200 and 299 and js ? 'id' then
      update public.invoices
         set status = 'inviata', itx_send_id = (js ->> 'id')::bigint, sent_at = now(),
             sdi_identifier = nullif(js ->> 'identifier', ''), file_name = coalesce(file_name, nullif(js ->> 'file_name', ''))
       where id = inv.id;
      n_sent := n_sent + 1;
    else
      update public.invoices
         set status = 'errore',
             sdi_message = coalesce(
               case when resp.timed_out then 'Invoicetronic non ha risposto in tempo: riprova' end,
               resp.error_msg,
               js ->> 'detail', js ->> 'title',
               case resp.status_code when 401 then 'Chiave Invoicetronic non valida' when 403 then 'Operazioni esaurite o chiave non abilitata' end,
               left(resp.content, 500), 'Errore ' || resp.status_code),
             sdi_errors = coalesce(js -> 'errors', js -> 'validation_errors')
       where id = inv.id;
      perform public.invoicing_notify('Fattura non inviata', 'La fattura ' || inv.number || '/' || inv.year || ' non è partita: apri il dettaglio per il motivo', '/fatture?aperta=' || inv.id);
    end if;
  end loop;

  -- 2) risposte alle richieste di aggiornamento
  for r in select q.*, h.status_code, h.content from public.invoicing_requests q join net._http_response h on h.id = q.request_id
           where q.processed_at is null order by q.request_id loop
    begin js := r.content::jsonb; exception when others then js := null; end;
    if r.status_code not between 200 and 299 then
      update public.invoicing_requests set processed_at = now(), result = 'HTTP ' || r.status_code || ': ' || left(coalesce(js ->> 'detail', r.content, ''), 300) where request_id = r.request_id;
      if r.kind = 'status' then
        update public.company_settings set invoicing_status = jsonb_build_object('ok', false, 'code', r.status_code, 'detail', coalesce(js ->> 'detail', js ->> 'title')), invoicing_checked_at = now() where id = 1;
      end if;
      continue;
    end if;
    if r.kind = 'update' and jsonb_typeof(js) = 'array' then
      select last_update into cur from public.invoicing_cursor where kind = 'update';
      mx := cur;
      for it in select * from jsonb_array_elements(js) loop
        mx := greatest(mx, (it ->> 'last_update')::timestamptz);
        select * into inv from public.invoices where itx_send_id = (it ->> 'send_id')::bigint;
        continue when inv.id is null;
        continue when inv.last_sdi_update is not null and inv.last_sdi_update > (it ->> 'last_update')::timestamptz;
        st := public.invoicing_state_status(it ->> 'state');
        update public.invoices
           set sdi_state = it ->> 'state', last_sdi_update = (it ->> 'last_update')::timestamptz,
               sdi_message = nullif(it ->> 'description', ''),
               sdi_errors = case when jsonb_typeof(it -> 'errors') = 'array' and jsonb_array_length(it -> 'errors') > 0 then it -> 'errors' else sdi_errors end,
               status = coalesce(st, status),
               delivered_at = case when st = 'consegnata' then coalesce(delivered_at, (it ->> 'last_update')::timestamptz) else delivered_at end,
               sdi_identifier = coalesce(sdi_identifier, nullif(it #>> '{send,identifier}', ''))
         where id = inv.id;
        n_upd := n_upd + 1;
        if st = 'scartata' and inv.status <> 'scartata' then
          perform public.invoicing_notify('Fattura scartata dallo SDI', 'Fattura ' || inv.number || '/' || inv.year || ': ' || coalesce(it ->> 'description', 'correggi e reinvia entro 5 giorni'), '/fatture?aperta=' || inv.id);
        elsif st = 'consegnata' and inv.status <> 'consegnata' and not inv.test then
          perform public.invoicing_notify('Fattura consegnata', 'Fattura ' || inv.number || '/' || inv.year || ' consegnata al cliente', '/fatture?aperta=' || inv.id);
        end if;
      end loop;
      update public.invoicing_cursor set last_update = mx where kind = 'update';
    elsif r.kind = 'receive' and jsonb_typeof(js) = 'array' then
      select last_update into cur from public.invoicing_cursor where kind = 'receive';
      mx := cur;
      for it in select * from jsonb_array_elements(js) loop
        mx := greatest(mx, coalesce((it ->> 'last_update')::timestamptz, (it ->> 'created')::timestamptz, mx));
        insert into public.purchase_invoices (test, itx_receive_id, sdi_identifier, file_name, supplier_vat, supplier_name, number, doc_date, payload, encoding, received_at)
        values (mode_test, (it ->> 'id')::bigint, nullif(it ->> 'identifier', ''), it ->> 'file_name', nullif(it ->> 'prestatore', ''), nullif(it ->> 'nome_prestatore', ''),
                it #>> '{documents,0,number}', (it #>> '{documents,0,date}')::timestamptz::date, it ->> 'payload', it ->> 'encoding',
                coalesce((it ->> 'date_sent')::timestamptz, (it ->> 'created')::timestamptz, now()))
        on conflict do nothing;
        if found then n_recv := n_recv + 1; end if;
      end loop;
      update public.invoicing_cursor set last_update = mx where kind = 'receive';
      if n_recv > 0 then
        perform public.invoicing_notify(case when n_recv = 1 then 'Nuova fattura fornitore' else n_recv || ' nuove fatture fornitori' end, 'Arrivate dallo SDI: controllale e registrale come spese', '/fatture?tab=ricevute');
      end if;
    elsif r.kind = 'status' then
      update public.company_settings set invoicing_status = coalesce(js, '{}'::jsonb) || jsonb_build_object('ok', true), invoicing_checked_at = now() where id = 1;
    elsif r.kind = 'company' then
      null;
    end if;
    update public.invoicing_requests set processed_at = now(), result = 'ok' where request_id = r.request_id;
  end loop;
  -- richieste senza risposta da troppo tempo
  update public.invoicing_requests set processed_at = now(), result = 'nessuna risposta'
   where processed_at is null and created_at < now() - interval '30 minutes';

  -- 3) nuove richieste (solo se collegato e se non ce ne sono già in corso)
  auth := public.invoicing_auth();
  if auth is not null then
    if not exists (select 1 from public.invoicing_requests where kind = 'update' and processed_at is null)
       and exists (select 1 from public.invoices where status in ('inviata') and itx_send_id is not null and deleted_at is null) then
      select last_update into cur from public.invoicing_cursor where kind = 'update';
      insert into public.invoicing_requests (request_id, kind)
      values (net.http_get(url := 'https://api.invoicetronic.com/v1/update',
                           params := jsonb_build_object('last_update_from', to_char(cur at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'page_size', '200', 'sort', 'last_update'),
                           headers := auth, timeout_milliseconds := 30000), 'update');
    end if;
    if not exists (select 1 from public.invoicing_requests where kind = 'receive' and processed_at is null) then
      select last_update into cur from public.invoicing_cursor where kind = 'receive';
      insert into public.invoicing_requests (request_id, kind)
      values (net.http_get(url := 'https://api.invoicetronic.com/v1/receive',
                           params := jsonb_build_object('last_update_from', to_char(cur at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'page_size', '50', 'sort', 'last_update', 'include_payload', 'true'),
                           headers := auth, timeout_milliseconds := 30000), 'receive');
    end if;
  end if;
  perform set_config('omnira.invoicing', 'off', true);
  return jsonb_build_object('inviate', n_sent, 'aggiornate', n_upd, 'ricevute', n_recv);
end $$;
revoke execute on function public.invoicing_sync() from public, anon;
grant execute on function public.invoicing_sync() to authenticated;

-- Verifica collegamento: stato account + registrazione dell'azienda (serve per ricevere le fatture)
create or replace function public.invoicing_check()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare auth jsonb; s record;
begin
  if not public.has_role(array['admin', 'amministrazione']::public.app_role[]) then raise exception 'Permesso negato' using errcode = '42501'; end if;
  auth := public.invoicing_auth();
  if auth is null then
    update public.company_settings set invoicing_status = jsonb_build_object('ok', false, 'detail', 'Chiave non presente nel Vault'), invoicing_checked_at = now() where id = 1;
    return 'senza_chiave';
  end if;
  insert into public.invoicing_requests (request_id, kind)
  values (net.http_get(url := 'https://api.invoicetronic.com/v1/status', headers := auth, timeout_milliseconds := 15000), 'status');
  select * into s from public.company_settings where id = 1;
  if s.vat_number is not null then
    insert into public.invoicing_requests (request_id, kind)
    values (net.http_post(url := 'https://api.invoicetronic.com/v1/company',
                          body := jsonb_build_object('vat', 'IT' || regexp_replace(s.vat_number, '^IT', '', 'i'), 'fiscal_code', coalesce(s.tax_code, s.vat_number), 'name', s.legal_name),
                          headers := auth || '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 15000), 'company');
  end if;
  return 'ok';
end $$;
revoke execute on function public.invoicing_check() from public, anon;
grant execute on function public.invoicing_check() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omnira-fatture-sdi', '*/10 * * * *', 'select public.invoicing_sync()');
  end if;
end $$;

-- Rinnovo automatico: alla scadenza il gestionale crea da solo l'incasso (e la spesa, se c'è un costo)
-- e sposta la scadenza al periodo successivo. Gira ogni mattina; recupera anche i periodi saltati.
create or replace function public.process_auto_renewals()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  guard integer;
  due date;
begin
  for r in
    select id, name, price_cents, client_id, created_by from public.renewals
    where active and auto_renew and deleted_at is null and next_due_date <= current_date
  loop
    guard := 0;
    loop
      select next_due_date into due from public.renewals where id = r.id;
      exit when due > current_date or guard >= 24;
      perform public.renew_renewal(r.id, true, true);
      guard := guard + 1;
      n := n + 1;
    end loop;
    -- avviso a chi gestisce i soldi: incasso creato in automatico
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'scadenza', 'Rinnovo automatico: ' || r.name,
           case when r.client_id is not null and coalesce(r.price_cents, 0) > 0
                then case when guard > 1 then 'Creati ' || guard || ' incassi da ' else 'Creato l''incasso da ' end || replace(to_char(r.price_cents / 100.0, 'FM9999990.00'), '.', ',') || ' € · prossima scadenza ' || to_char(due, 'DD/MM/YYYY')
                else 'Prossima scadenza ' || to_char(due, 'DD/MM/YYYY') end,
           '/scadenze?aperto=' || r.id
    from public.profiles p
    where p.active and p.role in ('admin', 'amministrazione');
  end loop;
  return n;
end $$;
revoke execute on function public.process_auto_renewals() from public, anon, authenticated;

comment on column public.renewals.auto_renew is 'Se vero, alla scadenza il gestionale rinnova da solo: crea incasso/spesa e passa al periodo successivo';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omnira-rinnovi-automatici', '30 6 * * *', 'select public.process_auto_renewals()');
  end if;
end $$;

-- Alla scadenza di un rinnovo il gestionale chiede "è stato pagato?":
-- sì → si registra il pagamento (va negli incassati); no → resta da incassare e non lo richiede più.
alter table public.receivables add column payment_confirmed_at timestamptz;
comment on column public.receivables.payment_confirmed_at is 'Risposta data alla domanda "è stato pagato?" (rinnovi scaduti)';

-- L'avviso del rinnovo automatico porta alla domanda in dashboard
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
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'scadenza', 'Rinnovo automatico: ' || r.name,
           case when r.client_id is not null and coalesce(r.price_cents, 0) > 0
                then case when guard > 1 then 'Creati ' || guard || ' incassi da ' else 'Creato l''incasso da ' end || replace(to_char(r.price_cents / 100.0, 'FM9999990.00'), '.', ',') || ' € — è stato pagato? Rispondi in dashboard'
                else 'Prossima scadenza ' || to_char(due, 'DD/MM/YYYY') end,
           case when r.client_id is not null and coalesce(r.price_cents, 0) > 0 then '/?pagamenti=1' else '/scadenze?aperto=' || r.id end
    from public.profiles p
    where p.active and p.role in ('admin', 'amministrazione');
  end loop;
  return n;
end $$;
revoke execute on function public.process_auto_renewals() from public, anon, authenticated;

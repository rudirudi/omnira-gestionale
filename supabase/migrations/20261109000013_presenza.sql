-- Presenza: chi ha il gestionale aperto. Il browser manda un segnale ogni minuto;
-- online = segnale negli ultimi 2 minuti e mezzo. Tabella a parte per non toccare i profili.
create table public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
create policy user_presence_select on public.user_presence for select to authenticated
  using ((select public.is_staff()));
grant select on public.user_presence to authenticated;

create or replace function public.chat_heartbeat()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then return; end if;
  insert into public.user_presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end $$;
revoke execute on function public.chat_heartbeat() from public, anon;
grant execute on function public.chat_heartbeat() to authenticated;

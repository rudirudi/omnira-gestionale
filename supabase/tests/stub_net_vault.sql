-- Sostituti locali di pg_net e Vault (solo per i test: su Supabase esistono già)
create schema if not exists extensions;
create schema if not exists net;
create table if not exists net._http_response (id bigint primary key, status_code integer, content text, error_msg text, created timestamptz default now());
create table if not exists net.requests (id bigint generated always as identity primary key, url text, headers jsonb, body jsonb);
create or replace function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') returns bigint language plpgsql as $$
declare i bigint;
begin
  insert into net.requests (url, headers, body) values (url, headers, body) returning id into i;
  insert into net._http_response (id, status_code, content) values (i, 200, '{"id":"fake"}');
  return i;
end $$;
create schema if not exists vault;
create table if not exists vault.secrets_raw (name text primary key, decrypted_secret text);
create or replace view vault.decrypted_secrets as select name, decrypted_secret from vault.secrets_raw;

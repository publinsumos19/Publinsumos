-- Lo que Supabase trae de fábrica y que el sistema necesita: roles, usuarios y auth.uid().
-- Se ejecuta al arrancar el servidor en Railway, antes de supabase/schema.sql. Se puede repetir sin problema.
create extension if not exists pgcrypto;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant anon, authenticated to authenticator;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text not null,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists auth.refresh_tokens (
  token text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
-- Valores internos del servidor (clave para firmar sesiones, contraseña del rol de la API).
create table if not exists auth.ajustes (clave text primary key, valor text not null);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;

-- La API solo puede usar auth.uid(); las tablas de usuarios y sesiones quedan fuera de su alcance.
revoke all on all tables in schema auth from anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;

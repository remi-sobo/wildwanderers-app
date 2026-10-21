-- ============================================================
-- A minimal stand-in for the pieces of Supabase the migrations
-- touch, so they apply to a plain local Postgres for RLS tests.
-- Test infrastructure only. Never applied to a real project.
--
-- Matches Supabase where it matters for access checks: the anon,
-- authenticated and service_role database roles, default grants on
-- public, and auth.uid() read from the request's JWT claims.
-- ============================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role'
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language sql immutable
as $$ select string_to_array(name, '/') $$;

create publication supabase_realtime;  -- wal_level warning locally is harmless

-- Supabase grants table, sequence and function access on public to
-- the API roles and relies on RLS to decide rows. Mirror that, so a
-- test that passes here is testing the policies, not missing grants.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ============================================================
-- Team Esface — Harden RLS Helper Functions
-- Sprint 0, Day 3 (post-policy follow-up)
--
-- The Supabase security advisor flagged two warnings on the helper
-- functions used by every RLS policy in the database:
--
--   1. `function_search_path_mutable` — `get_user_role()` and
--      `get_user_org()` did not pin their `search_path`. A future
--      search_path attack could shadow `auth.uid()` or the
--      `profiles` table.
--   2. `anon_security_definer_function_executable` — these
--      `SECURITY DEFINER` helpers were callable by the `anon` role
--      via `/rest/v1/rpc/`. Anonymous callers should never need them
--      (auth.uid() is null without a session anyway), so revoke
--      execute from `anon`/`public` and grant only to `authenticated`.
--
-- This migration recreates both functions with `set search_path =
-- pg_catalog, public` and tightens the grants.
-- ============================================================

create or replace function public.get_user_role()
returns user_role
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_user_org()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_user_role() from public, anon;
revoke execute on function public.get_user_org()  from public, anon;
grant  execute on function public.get_user_role() to authenticated;
grant  execute on function public.get_user_org()  to authenticated;

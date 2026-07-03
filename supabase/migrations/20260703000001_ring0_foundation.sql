-- ============================================================
-- Wild Wanderers — Ring 0 Foundation
--
-- Forked from the Team Esface schema (team-esface-migrations/),
-- retargeted from youth sport to adult wellness. Keeps the hardened
-- RLS helpers and the org-isolation + role policy shape, drops the
-- sport.
--
-- Retarget map (Team Esface -> Wild Wanderers):
--   user_role admin/coach/parent/athlete -> owner/coach/client/parent
--   organizations -> organizations   (colors default to forest/amber)
--   profiles      -> profiles
--   athletes      -> clients
--   teams         -> groups
--   coach_teams   -> group_coaches
--   athlete_teams -> client_groups
--
-- Helpers ported verbatim from
--   team-esface-migrations/20250520000002_harden_rls_helpers.sql
-- plus current_user_client_id(), mirroring the SECURITY DEFINER
-- recursion helpers in
--   team-esface-migrations/20250525000001_rls_recursion_helpers.sql
--
-- Every table has RLS on. Org isolation on every row. Owner and coach
-- manage clients, groups, and the join tables within their org. A
-- client reads only their own client row and their own client_groups.
-- Seeds one org: Wild Wanderers Fitness.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────
create type user_role as enum ('owner', 'coach', 'client', 'parent');
create type client_status as enum ('active', 'paused', 'archived');
create type group_kind as enum ('fitness_group', 'cohort');

-- ── Organizations ──────────────────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text default '#2E4A33',    -- forest
  secondary_color text default '#D98A3A',   -- amber
  created_at timestamptz default now()
);

-- ── Profiles ───────────────────────────────────────────────
-- One row per auth user. role and org_id decide every surface.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role user_role not null default 'client',
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Clients (was athletes) ─────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id),      -- null for a client without a login yet
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  photo_url text,
  goal text,
  status client_status not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Groups (was teams) ─────────────────────────────────────
create table groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  kind group_kind not null default 'fitness_group',
  coach_id uuid references profiles(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── group_coaches (was coach_teams) ────────────────────────
-- org_id is carried on the row so org isolation is a direct check,
-- never a cross-table subselect. See the RLS note below.
create table group_coaches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  group_id uuid references groups(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (coach_id, group_id)
);

-- ── client_groups (was athlete_teams) ──────────────────────
create table client_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  group_id uuid references groups(id) on delete cascade not null,
  joined_at timestamptz default now(),
  left_at timestamptz,
  unique (client_id, group_id)
);

-- ── Foreign-key indexes ────────────────────────────────────
create index idx_profiles_org        on profiles (org_id);
create index idx_clients_org         on clients (org_id);
create index idx_clients_user        on clients (user_id);
create index idx_groups_org          on groups (org_id);
create index idx_groups_coach        on groups (coach_id);
create index idx_group_coaches_org   on group_coaches (org_id);
create index idx_group_coaches_group on group_coaches (group_id);
create index idx_group_coaches_coach on group_coaches (coach_id);
create index idx_client_groups_org    on client_groups (org_id);
create index idx_client_groups_client on client_groups (client_id);
create index idx_client_groups_group  on client_groups (group_id);

-- ============================================================
-- HELPER FUNCTIONS
-- Ported from 20250520000002_harden_rls_helpers.sql: security
-- definer, stable, pinned search_path, execute granted to
-- authenticated only, never anon.
-- ============================================================

create or replace function public.get_user_role()
returns user_role
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_user_org()
returns uuid
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Mirrors current_user_child_athlete_ids() from the recursion-helpers
-- migration: hides the clients subselect from the planner so the
-- client_groups -> clients read never reopens an RLS cycle.
create or replace function public.current_user_client_id()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.clients where user_id = auth.uid();
$$;

revoke execute on function public.get_user_role()         from public, anon;
revoke execute on function public.get_user_org()          from public, anon;
revoke execute on function public.current_user_client_id() from public, anon;
grant  execute on function public.get_user_role()         to authenticated;
grant  execute on function public.get_user_org()          to authenticated;
grant  execute on function public.current_user_client_id() to authenticated;

-- ============================================================
-- NEW-USER PROFILE TRIGGER
-- Every auth signup gets a profile row so a session always resolves
-- to a role. Defaults are tenant-neutral: role 'client', org_id null.
-- The seed path sets Gabe to owner + the Wild Wanderers org, and the
-- test client's org. Nothing here hardcodes an org.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The trigger fires as its owner, so no role needs EXECUTE. Revoke it
-- from everyone so the function is not callable via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations enable row level security;
alter table profiles      enable row level security;
alter table clients       enable row level security;
alter table groups        enable row level security;
alter table group_coaches enable row level security;
alter table client_groups enable row level security;

-- ── organizations ──────────────────────────────────────────
create policy "members_read_own_org"
  on organizations for select
  using (id = get_user_org());

create policy "owner_update_own_org"
  on organizations for update
  using (id = get_user_org() and get_user_role() = 'owner')
  with check (id = get_user_org() and get_user_role() = 'owner');

-- ── profiles ───────────────────────────────────────────────
-- Flat org + role checks only, no cross-table subselects, so the
-- profiles read that the middleware relies on can never recurse
-- (the failure the Team Esface drop_recursive_profile_policies
-- migration documents).
create policy "users_read_own_profile"
  on profiles for select
  using (id = auth.uid());

create policy "users_update_own_profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "staff_read_org_profiles"
  on profiles for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "owner_write_org_profiles"
  on profiles for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ── clients ────────────────────────────────────────────────
create policy "staff_manage_clients"
  on clients for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_record"
  on clients for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and user_id = auth.uid()
  );

-- ── groups ─────────────────────────────────────────────────
create policy "staff_manage_groups"
  on groups for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── group_coaches ──────────────────────────────────────────
create policy "staff_manage_group_coaches"
  on group_coaches for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── client_groups ──────────────────────────────────────────
create policy "staff_manage_client_groups"
  on client_groups for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_client_groups"
  on client_groups for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  );

-- ============================================================
-- SEED — one organization
-- ============================================================

insert into organizations (name, slug, primary_color, secondary_color)
values ('Wild Wanderers Fitness', 'wild-wanderers-fitness', '#2E4A33', '#D98A3A')
on conflict (slug) do nothing;

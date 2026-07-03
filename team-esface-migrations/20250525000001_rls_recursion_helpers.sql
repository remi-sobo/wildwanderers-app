-- ============================================================
-- Team Esface — Break athletes ⟷ parent_athletes ⟷ coach_teams
-- RLS cycles via SECURITY DEFINER helpers.
--
-- Before this migration, the cross-table subselects in the
-- athletes / parent_athletes / coach_teams policies formed two
-- cycles:
--
--   1. athletes.parents_read_own_children → parent_athletes
--      parent_athletes.athletes_read_own_links → athletes
--
--   2. athletes.coaches_read_roster_athletes → coach_teams
--      coach_teams.athletes_read_own_coach_teams → athletes
--      (also: coach_teams.parents_read_child_coach_teams → athletes)
--
-- Postgres detects the cycle at plan time and rejects every query
-- that touches these tables — parents reading their own kids,
-- coaches reading their roster, evaluations / plan / completion
-- reads via the parent or coach role. Manifests as
-- "infinite recursion detected in policy for relation 'athletes'".
--
-- Fix pattern is the same one get_user_role() / get_user_org()
-- already use: SECURITY DEFINER helpers owned by `postgres`
-- (which has BYPASSRLS). Their internal queries bypass the table
-- they read, so the policy expression that calls them doesn't
-- traverse another RLS-protected subselect — the cycle never
-- reopens.
--
-- Already applied to the hosted project via MCP; this file is
-- here so local and remote agree.
-- ============================================================

-- ─── Helpers ───────────────────────────────────────────────

create or replace function public.current_user_child_athlete_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(athlete_id), '{}'::uuid[])
  from public.parent_athletes
  where parent_id = auth.uid();
$$;

create or replace function public.current_user_child_team_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(distinct a.current_team_id), '{}'::uuid[])
  from public.athletes a
  join public.parent_athletes pa on pa.athlete_id = a.id
  where pa.parent_id = auth.uid()
    and a.current_team_id is not null;
$$;

create or replace function public.current_user_coach_team_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(team_id), '{}'::uuid[])
  from public.coach_teams
  where coach_id = auth.uid();
$$;

revoke execute on function public.current_user_child_athlete_ids() from public, anon;
revoke execute on function public.current_user_child_team_ids()    from public, anon;
revoke execute on function public.current_user_coach_team_ids()    from public, anon;
grant  execute on function public.current_user_child_athlete_ids() to authenticated;
grant  execute on function public.current_user_child_team_ids()    to authenticated;
grant  execute on function public.current_user_coach_team_ids()    to authenticated;

-- ─── athletes — rewrite the two cycle-completing policies ──

drop policy if exists "coaches_read_roster_athletes" on public.athletes;
create policy "coaches_read_roster_athletes"
  on public.athletes for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and current_team_id = any (current_user_coach_team_ids())
  );

drop policy if exists "parents_read_own_children" on public.athletes;
create policy "parents_read_own_children"
  on public.athletes for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and id = any (current_user_child_athlete_ids())
  );

-- ─── parent_athletes — drop the athlete-side "look around" policy ──
--
-- Athletes don't query parent_athletes in V1. Removing this breaks
-- the parent_athletes → athletes leg of the cycle.

drop policy if exists "athletes_read_own_links" on public.parent_athletes;

-- ─── coach_teams — drop the athlete-side policy, rewrite the parent one ──

drop policy if exists "athletes_read_own_coach_teams" on public.coach_teams;

drop policy if exists "parents_read_child_coach_teams" on public.coach_teams;
create policy "parents_read_child_coach_teams"
  on public.coach_teams for select
  using (
    get_user_role() = 'parent'
    and team_id = any (current_user_child_team_ids())
  );

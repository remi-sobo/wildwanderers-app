-- ============================================================
-- Season summaries — RLS + public-read helper.
--
-- Authenticated reads use regular RLS scoped through the
-- SECURITY DEFINER helpers introduced earlier (no cycles):
--   admin   → full in org
--   coach   → read for athletes on their roster
--   parent  → read for their child(ren)
--   athlete → read own
--
-- Writes (generate / regenerate):
--   admin   → full
--   coach   → insert / update for athletes on their roster
--
-- Public read via share_token uses get_season_summary_by_token,
-- a SECURITY DEFINER function executable by anon + authenticated.
-- The 32-hex token (gen_random_bytes(16)) is the access control;
-- the snapshot has no PII beyond the athlete's name + season
-- aggregates the parent already shares with grandparents/scouts.
--
-- Already applied to the hosted DB via MCP; this file is here
-- so local and remote agree.
-- ============================================================

create policy "admins_full_access_season_summaries"
  on season_summaries for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_roster_season_summaries"
  on season_summaries for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "coaches_write_roster_season_summaries"
  on season_summaries for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "coaches_update_roster_season_summaries"
  on season_summaries for update
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  )
  with check (
    org_id = get_user_org()
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "parents_read_child_season_summaries"
  on season_summaries for select
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

create policy "athletes_read_own_season_summaries"
  on season_summaries for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create or replace function public.get_season_summary_by_token(token text)
returns season_summaries
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select * from public.season_summaries where share_token = token limit 1;
$$;

revoke execute on function public.get_season_summary_by_token(text) from public;
grant  execute on function public.get_season_summary_by_token(text) to anon, authenticated;

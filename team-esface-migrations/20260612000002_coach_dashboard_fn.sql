-- ============================================================
-- SCALE & POLISH (Phase 6) — coach dashboard in one round trip
-- ============================================================
-- The coach landing page ran five sequential queries (teams →
-- athletes → latest evaluations → open reviews → plan count), each
-- paying network latency. One SECURITY INVOKER function does it in
-- a single round trip; the caller's own RLS still governs every
-- table it touches.

create or replace function public.coach_dashboard(p_season text)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with my_teams as (
    select t.id, t.name
    from coach_teams ct
    join teams t on t.id = ct.team_id
    where ct.coach_id = (select auth.uid())
      and ct.season = p_season
  ),
  roster as (
    select a.id, a.first_name, a.last_name, a.grade, a.tier,
           a.current_team_id, a.current_plan_id
    from athletes a
    where a.current_team_id in (select id from my_teams)
      and a.is_active
  ),
  latest_evals as (
    select distinct on (e.athlete_id)
           e.athlete_id, e.status, e.completed_at
    from evaluations e
    where e.athlete_id in (select id from roster)
      and e.season = p_season
    order by e.athlete_id, e.created_at desc
  ),
  open_reviews as (
    select r.id, r.athlete_id, r.status, r.scheduled_at
    from review_sessions r
    where r.athlete_id in (select id from roster)
      and r.status in ('pending', 'scheduled')
  )
  select jsonb_build_object(
    'teams', coalesce(
      (select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
       from my_teams),
      '[]'::jsonb
    ),
    'athletes', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'id', r.id,
           'first_name', r.first_name,
           'last_name', r.last_name,
           'grade', r.grade,
           'tier', r.tier,
           'eval_status', le.status,
           'eval_completed_at', le.completed_at
         )
         order by r.last_name, r.first_name
       )
       from roster r
       left join latest_evals le on le.athlete_id = r.id),
      '[]'::jsonb
    ),
    'open_reviews', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'id', id,
           'athlete_id', athlete_id,
           'status', status,
           'scheduled_at', scheduled_at
         )
         order by scheduled_at asc nulls first
       )
       from open_reviews),
      '[]'::jsonb
    ),
    'active_plan_count',
      (select count(*) from roster where current_plan_id is not null)
  );
$$;

revoke execute on function public.coach_dashboard(text) from public, anon;
grant  execute on function public.coach_dashboard(text) to authenticated;

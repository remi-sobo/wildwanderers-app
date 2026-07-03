-- ============================================================
-- Program leaderboard
--
-- SECURITY DEFINER function that returns the ranked roster
-- (current-season, active athletes only) for the calling user's
-- org. Bypasses RLS internally so the function can see every
-- athlete's stats regardless of the caller's role.
--
-- Already applied to the hosted DB via MCP. This file is here
-- so local + remote agree.
-- ============================================================

create or replace function public.program_leaderboard(p_org_id uuid)
returns table (
  athlete_id uuid,
  first_name text,
  last_name text,
  jersey_number int,
  tier team_tier,
  current_team_id uuid,
  team_name text,
  reps_logged bigint,
  plans_completed bigint,
  current_streak int
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
-- The RETURN TABLE column names collide with column names in the
-- CTEs below (athlete_id, etc.). This directive tells pl/pgsql to
-- resolve those references as column names, not as out-parameter
-- variables.
#variable_conflict use_column
begin
  if get_user_org() is null or get_user_org() <> p_org_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with active_athletes as (
    select a.id, a.first_name, a.last_name, a.jersey_number, a.tier,
           a.current_team_id, a.current_plan_id
    from athletes a
    where a.org_id = p_org_id and a.is_active = true
  ),
  reps as (
    select ac.athlete_id, count(*)::bigint as reps_count
    from activity_completions ac
    where ac.athlete_id in (select id from active_athletes)
    group by ac.athlete_id
  ),
  plan_day_status as (
    select
      p.athlete_id, p.id as plan_id, p.start_date as plan_start_date,
      pd.day_number,
      sum(case when coalesce(pa.is_required, true) then 1 else 0 end)::int as req,
      sum(case when coalesce(pa.is_required, true) and ac.id is not null then 1 else 0 end)::int as done
    from transformation_plans p
    join plan_days pd on pd.plan_id = p.id
    join plan_activities pa on pa.plan_day_id = pd.id
    left join activity_completions ac on ac.plan_activity_id = pa.id and ac.athlete_id = p.athlete_id
    where p.athlete_id in (select id from active_athletes)
    group by p.athlete_id, p.id, p.start_date, pd.day_number
  ),
  per_plan_done as (
    select athlete_id, plan_id,
           bool_and(req > 0 and req = done) as all_days_hit,
           bool_or(req > 0) as has_required
    from plan_day_status
    group by athlete_id, plan_id
  ),
  plans_completed_cte as (
    select athlete_id, count(*)::bigint as cnt
    from per_plan_done
    where has_required and all_days_hit
    group by athlete_id
  ),
  active_plan as (
    select aa.id as athlete_id, aa.current_plan_id, p.start_date as plan_start_date
    from active_athletes aa
    join transformation_plans p on p.id = aa.current_plan_id
    where aa.current_plan_id is not null
      and p.start_date is not null
      and current_date >= p.start_date
  ),
  past_day_hits as (
    select pds.athlete_id, pds.day_number,
           case
             when pds.req = 0 then true
             when pds.req > 0 and pds.req = pds.done then true
             else false
           end as is_hit
    from plan_day_status pds
    join active_plan ap on ap.athlete_id = pds.athlete_id and ap.current_plan_id = pds.plan_id
    where pds.day_number < (current_date - ap.plan_start_date)::int + 1
  ),
  hits_arrays as (
    select athlete_id, array_agg(is_hit order by day_number desc) as hits
    from past_day_hits
    group by athlete_id
  ),
  streaks as (
    select athlete_id,
           coalesce(
             array_position(hits, false) - 1,
             array_length(hits, 1),
             0
           )::int as current_streak
    from hits_arrays
  )
  select
    aa.id, aa.first_name, aa.last_name, aa.jersey_number, aa.tier,
    aa.current_team_id, t.name as team_name,
    coalesce(reps.reps_count, 0)::bigint,
    coalesce(plans_completed_cte.cnt, 0)::bigint,
    coalesce(streaks.current_streak, 0)::int
  from active_athletes aa
  left join teams t on t.id = aa.current_team_id
  left join reps on reps.athlete_id = aa.id
  left join plans_completed_cte on plans_completed_cte.athlete_id = aa.id
  left join streaks on streaks.athlete_id = aa.id
  order by aa.id;
end;
$$;

revoke execute on function public.program_leaderboard(uuid) from public;
grant  execute on function public.program_leaderboard(uuid) to authenticated;

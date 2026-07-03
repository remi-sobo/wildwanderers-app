-- ============================================================
-- Team Esface — Level System
--
-- A 10-level belt progression layered on top of MBHS evaluations.
--   * level_definitions  — the 10 belts, per org (admin-configurable)
--   * level_requirements — the gates that earn each belt
--   * get_athlete_current_level() — computes a belt number from the
--     athlete's latest completed evaluation + program participation
--
-- RLS: admins read/write within their org; coaches, parents and
-- athletes read only.
--
-- NOTE on the file name: the brief asked for 20250519000001, but that
-- version string already belongs to 20250519000001_day2_policies.sql
-- (Supabase keys migrations by the leading timestamp, so a duplicate
-- breaks the ledger and would sort before 13 newer migrations). This
-- file uses today's date to stay unique and ordered.
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

create table level_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  level_number int not null check (level_number between 1 and 10),
  name text not null,
  tagline text,
  color text not null,
  is_belt_level boolean default true,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (org_id, level_number)
);

create table level_requirements (
  id uuid primary key default gen_random_uuid(),
  level_id uuid references level_definitions(id) on delete cascade,
  requirement_type text not null
    check (requirement_type in ('mbhs_rating', 'program', 'non_negotiable')),
  label text not null,
  metric_key text not null,
  target_value numeric not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index level_requirements_level_id_idx on level_requirements (level_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table level_definitions  enable row level security;
alter table level_requirements enable row level security;

-- Admins: full read/write within their org.
create policy "admins_full_access_level_definitions"
  on level_definitions for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- Coaches, parents, athletes: read-only within their org.
create policy "members_read_level_definitions"
  on level_definitions for select
  using (org_id = get_user_org());

-- level_requirements has no org column — scope through the parent level.
create policy "admins_full_access_level_requirements"
  on level_requirements for all
  using (
    get_user_role() = 'admin'
    and level_id in (select id from level_definitions where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and level_id in (select id from level_definitions where org_id = get_user_org())
  );

create policy "members_read_level_requirements"
  on level_requirements for select
  using (
    level_id in (select id from level_definitions where org_id = get_user_org())
  );

-- ============================================================
-- SEED — the default 10 levels for the org
-- ============================================================
-- Idempotent: levels upsert on (org_id, level_number); requirements
-- only seed when the org has none yet, so re-running is safe.

do $$
declare
  v_org uuid := (select id from organizations limit 1);
  v_l1 uuid; v_l2 uuid; v_l3 uuid; v_l4 uuid; v_l5 uuid;
  v_l6 uuid; v_l7 uuid; v_l8 uuid; v_l9 uuid; v_l10 uuid;
begin
  if v_org is null then
    raise notice 'No organization found — skipping level seed.';
    return;
  end if;

  insert into level_definitions
    (org_id, level_number, name, tagline, color, is_belt_level, sort_order)
  values
    (v_org, 1,  'Foundation', 'Every journey starts here.',          '#9CA3AF', true,  1),
    (v_org, 2,  'Rising',     'The work is starting to show.',        '#EAB308', true,  2),
    (v_org, 3,  'Building',   'Brick by brick.',                      '#F97316', true,  3),
    (v_org, 4,  'Developing', 'Sharpening every edge.',               '#22C55E', true,  4),
    (v_org, 5,  'Competitor', 'Ready to compete every possession.',   '#3B82F6', true,  5),
    (v_org, 6,  'Advanced',   'Separating from the pack.',            '#A855F7', true,  6),
    (v_org, 7,  'Premier',    'Among the program''s best.',           '#92400E', true,  7),
    (v_org, 8,  'Elite',      'Rare air.',                            '#DC1E1E', true,  8),
    (v_org, 9,  'Mastered',   'Command of the craft.',                '#E8E8E8', true,  9),
    (v_org, 10, 'Esface',     'This is The Way.',                     '#DC1E1E', false, 10)
  on conflict (org_id, level_number) do nothing;

  select id into v_l1  from level_definitions where org_id = v_org and level_number = 1;
  select id into v_l2  from level_definitions where org_id = v_org and level_number = 2;
  select id into v_l3  from level_definitions where org_id = v_org and level_number = 3;
  select id into v_l4  from level_definitions where org_id = v_org and level_number = 4;
  select id into v_l5  from level_definitions where org_id = v_org and level_number = 5;
  select id into v_l6  from level_definitions where org_id = v_org and level_number = 6;
  select id into v_l7  from level_definitions where org_id = v_org and level_number = 7;
  select id into v_l8  from level_definitions where org_id = v_org and level_number = 8;
  select id into v_l9  from level_definitions where org_id = v_org and level_number = 9;
  select id into v_l10 from level_definitions where org_id = v_org and level_number = 10;

  -- Only seed requirements if this org has none yet (idempotent re-runs).
  if not exists (
    select 1
    from level_requirements lr
    join level_definitions ld on ld.id = lr.level_id
    where ld.org_id = v_org
  ) then
    insert into level_requirements
      (level_id, requirement_type, label, metric_key, target_value, sort_order)
    values
      -- Level 1 — Foundation
      (v_l1, 'program', 'Receive first evaluation', 'evals', 1, 1),

      -- Level 2 — Rising
      (v_l2, 'mbhs_rating', 'Ball Handling',               'skill_ball_handling',    2, 1),
      (v_l2, 'mbhs_rating', 'Humble Baller (Coachable)',   'heart_humble_coachable', 2, 2),
      (v_l2, 'program',     'Complete 1 Transformation Plan', 'plans',               1, 3),
      (v_l2, 'program',     'Receive 2 evaluations',       'evals',                  2, 4),

      -- Level 3 — Building
      (v_l3, 'mbhs_rating', 'IQ',                'mind_iq',               2, 1),
      (v_l3, 'mbhs_rating', 'On-Ball Defense',   'skill_on_ball_defense', 2, 2),
      (v_l3, 'mbhs_rating', 'Finishing',         'skill_finishing',       2, 3),
      (v_l3, 'mbhs_rating', 'Hunger / Motivation', 'heart_hunger',        3, 4),
      (v_l3, 'program',     'Complete 2 Transformation Plans', 'plans',   2, 5),

      -- Level 4 — Developing
      (v_l4, 'mbhs_rating',    'IQ',                       'mind_iq',                3, 1),
      (v_l4, 'mbhs_rating',    'Next Play Speed',          'mind_next_play_speed',   3, 2),
      (v_l4, 'mbhs_rating',    'Humble Baller (Teammate)', 'heart_humble_teammate',  3, 3),
      (v_l4, 'mbhs_rating',    'Finishing',                'skill_finishing',        3, 4),
      (v_l4, 'program',        'Complete 3 Transformation Plans', 'plans',           3, 5),
      (v_l4, 'program',        'Complete 1 Review Session', 'reviews',               1, 6),
      (v_l4, 'non_negotiable', 'Drive and attack off two feet', 'skill_finishing',   3, 7),

      -- Level 5 — Competitor
      (v_l5, 'mbhs_rating',    'IQ',              'mind_iq',                3, 1),
      (v_l5, 'mbhs_rating',    'Anti-Softness',   'mind_anti_softness',     3, 2),
      (v_l5, 'mbhs_rating',    'Hunger / Motivation', 'heart_hunger',       4, 3),
      (v_l5, 'mbhs_rating',    'Passing',         'skill_passing',          3, 4),
      (v_l5, 'mbhs_rating',    'On-Ball Defense', 'skill_on_ball_defense',  3, 5),
      (v_l5, 'program',        'Complete 4 Transformation Plans', 'plans',  4, 6),
      (v_l5, 'program',        'Receive 4 evaluations', 'evals',            4, 7),
      (v_l5, 'non_negotiable', 'Pass out of the drive', 'skill_passing',    3, 8),
      (v_l5, 'non_negotiable', 'Compete on defense every possession', 'skill_on_ball_defense', 3, 9),

      -- Level 6 — Advanced
      (v_l6, 'mbhs_rating',    'IQ',              'mind_iq',                4,   1),
      (v_l6, 'mbhs_rating',    'Explosiveness',   'body_explosiveness',     3,   2),
      (v_l6, 'mbhs_rating',    'Heart Average',   'heart_avg',              3.5, 3),
      (v_l6, 'mbhs_rating',    'Shooting',        'skill_shooting',         3,   4),
      (v_l6, 'mbhs_rating',    'On-Ball Defense', 'skill_on_ball_defense',  4,   5),
      (v_l6, 'program',        'Complete 5 Transformation Plans', 'plans',  5,   6),
      (v_l6, 'program',        'Complete 2 Review Sessions', 'reviews',     2,   7),
      (v_l6, 'non_negotiable', 'Catch and shoot at a high clip', 'skill_shooting', 3, 8),

      -- Level 7 — Premier
      (v_l7, 'mbhs_rating', 'IQ',               'mind_iq',                4, 1),
      (v_l7, 'mbhs_rating', 'Anti-Softness',    'mind_anti_softness',     4, 2),
      (v_l7, 'mbhs_rating', 'Heart Average',    'heart_avg',              4, 3),
      (v_l7, 'mbhs_rating', 'Ball Handling',    'skill_ball_handling',    4, 4),
      (v_l7, 'mbhs_rating', 'Finishing',        'skill_finishing',        4, 5),
      (v_l7, 'mbhs_rating', 'Off-Ball Defense', 'skill_off_ball_defense', 3, 6),
      (v_l7, 'program',     'Complete 6 Transformation Plans', 'plans',   6, 7),
      (v_l7, 'program',     'Receive 6 evaluations', 'evals',             6, 8),

      -- Level 8 — Elite
      (v_l8, 'mbhs_rating',    'Mind Average',    'mind_avg',               4,   1),
      (v_l8, 'mbhs_rating',    'Heart Average',   'heart_avg',              4.5, 2),
      (v_l8, 'mbhs_rating',    'Finishing',       'skill_finishing',        5,   3),
      (v_l8, 'mbhs_rating',    'On-Ball Defense', 'skill_on_ball_defense',  5,   4),
      (v_l8, 'program',        'Complete 7 Transformation Plans', 'plans',  7,   5),
      (v_l8, 'program',        '3+ seasons in the program', 'seasons',      3,   6),
      (v_l8, 'non_negotiable', 'All four non-negotiables at 4+', 'non_neg_avg', 4, 7),

      -- Level 9 — Mastered
      (v_l9, 'mbhs_rating',    'Overall MBHS Average', 'overall_avg',       4.5, 1),
      (v_l9, 'program',        'Complete 8 Transformation Plans', 'plans',  8,   2),
      (v_l9, 'program',        '4+ seasons in the program', 'seasons',      4,   3),
      (v_l9, 'non_negotiable', 'All non-negotiables at 5 (Elite)', 'non_neg_avg', 5, 4);

      -- Level 10 — Esface: graduation tier, no requirements.
  end if;
end $$;

-- ============================================================
-- FUNCTION — get_athlete_current_level(athlete) -> belt number
-- ============================================================
-- SECURITY DEFINER so it can read the athlete's evaluation +
-- participation regardless of the caller's RLS. When called by an
-- authenticated user, it refuses cross-org lookups; in a service /
-- SQL-editor context (auth.uid() null) it runs unguarded.
--
-- Natural Body attributes (Speed, Length) are intentionally excluded
-- from body_avg — only the earned three count, per the MBHS framework.

create or replace function public.get_athlete_current_level(p_athlete_id uuid)
returns int
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_org      uuid;
  v_eval     evaluations%rowtype;
  v_mind_avg numeric;
  v_body_avg numeric;
  v_heart_avg numeric;
  v_skill_avg numeric;
  v_overall_avg numeric;
  v_non_neg_avg numeric;
  v_plans    numeric;
  v_evals    numeric;
  v_reviews  numeric;
  v_seasons  numeric;
  v_vals     jsonb;
  v_level    record;
  v_req      record;
  v_all_met  boolean;
  v_result   int := 1;
begin
  select org_id into v_org from athletes where id = p_athlete_id;
  if v_org is null then
    return 1;
  end if;

  -- Authenticated callers may only look up athletes in their own org.
  if auth.uid() is not null and get_user_org() is distinct from v_org then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Latest completed evaluation (source of truth for MBHS ratings).
  select * into v_eval
  from evaluations
  where athlete_id = p_athlete_id and status = 'completed'
  order by completed_at desc nulls last
  limit 1;

  if v_eval.id is not null then
    v_mind_avg := (coalesce(v_eval.mind_iq, 0) + coalesce(v_eval.mind_next_play_speed, 0)
                 + coalesce(v_eval.mind_focus, 0) + coalesce(v_eval.mind_anti_softness, 0))::numeric / 4;
    v_body_avg := (coalesce(v_eval.body_explosiveness, 0) + coalesce(v_eval.body_stability, 0)
                 + coalesce(v_eval.body_stamina, 0))::numeric / 3;
    v_heart_avg := (coalesce(v_eval.heart_humble_teammate, 0) + coalesce(v_eval.heart_humble_coachable, 0)
                 + coalesce(v_eval.heart_positive, 0) + coalesce(v_eval.heart_hunger, 0))::numeric / 4;
    v_skill_avg := (coalesce(v_eval.skill_ball_handling, 0) + coalesce(v_eval.skill_finishing, 0)
                 + coalesce(v_eval.skill_passing, 0) + coalesce(v_eval.skill_shooting, 0)
                 + coalesce(v_eval.skill_on_ball_defense, 0) + coalesce(v_eval.skill_off_ball_defense, 0))::numeric / 6;
    v_overall_avg := (v_mind_avg + v_body_avg + v_heart_avg + v_skill_avg) / 4;
    v_non_neg_avg := (coalesce(v_eval.skill_finishing, 0) + coalesce(v_eval.skill_passing, 0)
                 + coalesce(v_eval.skill_shooting, 0) + coalesce(v_eval.skill_on_ball_defense, 0))::numeric / 4;
  end if;

  select count(*)               into v_plans   from transformation_plans where athlete_id = p_athlete_id and status = 'completed';
  select count(*)               into v_evals   from evaluations          where athlete_id = p_athlete_id and status = 'completed';
  select count(*)               into v_reviews from review_sessions      where athlete_id = p_athlete_id and status = 'completed';
  select count(distinct season) into v_seasons from evaluations          where athlete_id = p_athlete_id and status = 'completed';

  v_vals := jsonb_build_object(
    'mind_iq',                coalesce(v_eval.mind_iq, 0),
    'mind_next_play_speed',   coalesce(v_eval.mind_next_play_speed, 0),
    'mind_focus',             coalesce(v_eval.mind_focus, 0),
    'mind_anti_softness',     coalesce(v_eval.mind_anti_softness, 0),
    'body_explosiveness',     coalesce(v_eval.body_explosiveness, 0),
    'body_stability',         coalesce(v_eval.body_stability, 0),
    'body_stamina',           coalesce(v_eval.body_stamina, 0),
    'heart_humble_teammate',  coalesce(v_eval.heart_humble_teammate, 0),
    'heart_humble_coachable', coalesce(v_eval.heart_humble_coachable, 0),
    'heart_positive',         coalesce(v_eval.heart_positive, 0),
    'heart_hunger',           coalesce(v_eval.heart_hunger, 0),
    'skill_ball_handling',    coalesce(v_eval.skill_ball_handling, 0),
    'skill_finishing',        coalesce(v_eval.skill_finishing, 0),
    'skill_passing',          coalesce(v_eval.skill_passing, 0),
    'skill_shooting',         coalesce(v_eval.skill_shooting, 0),
    'skill_on_ball_defense',  coalesce(v_eval.skill_on_ball_defense, 0),
    'skill_off_ball_defense', coalesce(v_eval.skill_off_ball_defense, 0),
    'mind_avg',     coalesce(v_mind_avg, 0),
    'body_avg',     coalesce(v_body_avg, 0),
    'heart_avg',    coalesce(v_heart_avg, 0),
    'skill_avg',    coalesce(v_skill_avg, 0),
    'overall_avg',  coalesce(v_overall_avg, 0),
    'non_neg_avg',  coalesce(v_non_neg_avg, 0),
    'plans',        v_plans,
    'evals',        v_evals,
    'reviews',      v_reviews,
    'seasons',      v_seasons
  );

  -- Walk belts 1→9 (10 is graduation-only, never auto-earned). The
  -- highest belt whose every active requirement is met wins.
  for v_level in
    select id, level_number
    from level_definitions
    where org_id = v_org and is_active = true and level_number between 1 and 9
    order by level_number
  loop
    v_all_met := true;
    for v_req in
      select metric_key, target_value
      from level_requirements
      where level_id = v_level.id and is_active = true
    loop
      if coalesce((v_vals ->> v_req.metric_key)::numeric, 0) < v_req.target_value then
        v_all_met := false;
        exit;
      end if;
    end loop;

    if v_all_met then
      v_result := v_level.level_number;
    end if;
  end loop;

  return v_result;
end;
$$;

revoke execute on function public.get_athlete_current_level(uuid) from public;
grant  execute on function public.get_athlete_current_level(uuid) to authenticated;

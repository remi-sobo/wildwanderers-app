-- ============================================================
-- LOCK THE DOORS (4/5) — atomic plan writes, one active plan
-- ============================================================
-- Plan creation was three sequential inserts (plan → days →
-- activities) from the app; a mid-flight failure left orphaned
-- half-plans. "One active plan per athlete" was application-trust
-- only — a coach approving and an athlete self-directing at the
-- same moment silently raced.
--
-- Fixes:
--   1. A partial unique index makes one-active-plan a database
--      guarantee. (Verified against the live data before the first
--      application: no athlete had duplicate active plans.)
--   2. `create_plan_atomic` writes plan + days + activities in one
--      transaction. SECURITY INVOKER — the caller's own RLS governs
--      every insert, exactly as the previous app-side inserts did.
--   3. `activate_plan_atomic` archives competing plans and activates
--      the target in one transaction, so the unique index can never
--      strand an athlete between "old archived" and "new active".

create unique index if not exists transformation_plans_one_active_per_athlete
  on transformation_plans (athlete_id)
  where status = 'active';

-- ── create_plan_atomic ────────────────────────────────────────
-- p_plan: the transformation_plans column values (status is forced
--         to 'draft' — activation is a separate, audited step).
-- p_days: [{ day_number, week_number, theme, activities: [{
--           knowledge_base_item_id, activity_type, title, content,
--           media_url, duration_minutes, sort_order, is_required }] }]
-- Returns: { plan_id, days: [{ id, day_number,
--            activities: [{ id, sort_order }] }] }
create or replace function public.create_plan_atomic(
  p_plan jsonb,
  p_days jsonb
)
returns jsonb
language plpgsql
security invoker
volatile
set search_path = pg_catalog, public
as $$
declare
  v_plan_id  uuid;
  v_day      jsonb;
  v_day_id   uuid;
  v_act      jsonb;
  v_act_id   uuid;
  v_days_out jsonb := '[]'::jsonb;
  v_acts_out jsonb;
begin
  insert into transformation_plans (
    org_id, athlete_id, evaluation_id, coach_id,
    focus_pillar, focus_subcategories, non_negotiable_focus,
    duration_weeks, status, start_date, end_date, ai_generated,
    initiated_by, plan_type, athlete_goals, has_gym_access,
    available_equipment, session_duration_minutes,
    ai_generated_content, generation_log
  )
  values (
    (p_plan ->> 'org_id')::uuid,
    (p_plan ->> 'athlete_id')::uuid,
    nullif(p_plan ->> 'evaluation_id', '')::uuid,
    nullif(p_plan ->> 'coach_id', '')::uuid,
    (p_plan ->> 'focus_pillar')::mbhs_pillar,
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_plan -> 'focus_subcategories')),
      '{}'::text[]
    ),
    p_plan ->> 'non_negotiable_focus',
    (p_plan ->> 'duration_weeks')::int,
    'draft'::plan_status,
    (p_plan ->> 'start_date')::date,
    (p_plan ->> 'end_date')::date,
    coalesce((p_plan ->> 'ai_generated')::boolean, false),
    coalesce(p_plan ->> 'initiated_by', 'coach')::user_role,
    coalesce(p_plan ->> 'plan_type', 'transformation'),
    p_plan ->> 'athlete_goals',
    coalesce((p_plan ->> 'has_gym_access')::boolean, true),
    (select array_agg(value) from jsonb_array_elements_text(p_plan -> 'available_equipment')),
    coalesce((p_plan ->> 'session_duration_minutes')::int, 30),
    coalesce((p_plan ->> 'ai_generated_content')::boolean, false),
    p_plan -> 'generation_log'
  )
  returning id into v_plan_id;

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    insert into plan_days (plan_id, day_number, week_number, theme)
    values (
      v_plan_id,
      (v_day ->> 'day_number')::int,
      (v_day ->> 'week_number')::int,
      v_day ->> 'theme'
    )
    returning id into v_day_id;

    v_acts_out := '[]'::jsonb;
    for v_act in select * from jsonb_array_elements(coalesce(v_day -> 'activities', '[]'::jsonb))
    loop
      insert into plan_activities (
        plan_day_id, knowledge_base_item_id, activity_type, title,
        content, media_url, duration_minutes, sort_order, is_required
      )
      values (
        v_day_id,
        nullif(v_act ->> 'knowledge_base_item_id', '')::uuid,
        (v_act ->> 'activity_type')::activity_type,
        v_act ->> 'title',
        v_act ->> 'content',
        v_act ->> 'media_url',
        coalesce((v_act ->> 'duration_minutes')::int, 10),
        (v_act ->> 'sort_order')::int,
        coalesce((v_act ->> 'is_required')::boolean, true)
      )
      returning id into v_act_id;

      v_acts_out := v_acts_out
        || jsonb_build_object('id', v_act_id, 'sort_order', (v_act ->> 'sort_order')::int);
    end loop;

    v_days_out := v_days_out || jsonb_build_object(
      'id', v_day_id,
      'day_number', (v_day ->> 'day_number')::int,
      'activities', v_acts_out
    );
  end loop;

  return jsonb_build_object('plan_id', v_plan_id, 'days', v_days_out);
end;
$$;

revoke execute on function public.create_plan_atomic(jsonb, jsonb) from public, anon;
grant  execute on function public.create_plan_atomic(jsonb, jsonb) to authenticated;

-- ── activate_plan_atomic ──────────────────────────────────────
-- Archives any other active / pending plans for the athlete and
-- activates the target, in one transaction. SECURITY INVOKER: RLS
-- decides whether the caller may update these rows at all.
create or replace function public.activate_plan_atomic(p_plan_id uuid)
returns void
language plpgsql
security invoker
volatile
set search_path = pg_catalog, public
as $$
declare
  v_athlete_id uuid;
begin
  select athlete_id into v_athlete_id
  from transformation_plans
  where id = p_plan_id;

  if v_athlete_id is null then
    raise exception 'Plan not found or not accessible';
  end if;

  update transformation_plans
     set status = 'archived', updated_at = now()
   where athlete_id = v_athlete_id
     and status in ('active', 'pending_approval')
     and id <> p_plan_id;

  update transformation_plans
     set status = 'active',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   where id = p_plan_id;
end;
$$;

revoke execute on function public.activate_plan_atomic(uuid) from public, anon;
grant  execute on function public.activate_plan_atomic(uuid) to authenticated;

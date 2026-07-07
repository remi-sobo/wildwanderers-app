-- ============================================================
-- Wild Wanderers — Ring 10.1b: the draft flow
--
-- Three changes, all on the Ring 1 plan engine:
--   * create_plan_atomic carries the new draft metadata (initiated_by,
--     ai_generated, origin_prompt).
--   * update_plan_atomic (new): rewrite a RESTING plan's shape in one
--     transaction. Guarded to draft/pending_review so an active plan is
--     never rewritten under a client mid-week.
--   * activate_plan_atomic stamps who approved and when.
--
-- Plus the leak fix this ring exists for: now that drafts rest instead
-- of activating instantly, the client read policy must exclude them.
-- Before this, a client with no active plan could read a resting draft
-- through the most-recent-plan fallback. Closed at the row level here
-- and in the query layer in the same ring.
-- ============================================================

-- ── create_plan_atomic: carry the draft metadata ─────────────
create or replace function public.create_plan_atomic(p_plan jsonb, p_workouts jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_plan_id uuid;
  v_workout jsonb;
  v_workout_id uuid;
  v_ex jsonb;
begin
  insert into public.training_plans
    (org_id, client_id, coach_id, title, goal, status, start_date, end_date,
     duration_weeks, notes, initiated_by, ai_generated, origin_prompt)
  values (
    v_org,
    (p_plan->>'client_id')::uuid,
    auth.uid(),
    p_plan->>'title',
    p_plan->>'goal',
    'draft',
    nullif(p_plan->>'start_date', '')::date,
    nullif(p_plan->>'end_date', '')::date,
    nullif(p_plan->>'duration_weeks', '')::int,
    p_plan->>'notes',
    coalesce(nullif(p_plan->>'initiated_by', '')::user_role, 'coach'),
    coalesce((p_plan->>'ai_generated')::boolean, false),
    nullif(p_plan->>'origin_prompt', '')
  )
  returning id into v_plan_id;

  for v_workout in select * from jsonb_array_elements(coalesce(p_workouts, '[]'::jsonb))
  loop
    insert into public.workouts (org_id, plan_id, day_number, week_number, title, notes)
    values (
      v_org, v_plan_id,
      (v_workout->>'day_number')::int,
      (v_workout->>'week_number')::int,
      v_workout->>'title',
      v_workout->>'notes'
    )
    returning id into v_workout_id;

    for v_ex in select * from jsonb_array_elements(coalesce(v_workout->'exercises', '[]'::jsonb))
    loop
      insert into public.workout_exercises
        (org_id, workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional)
      values (
        v_org, v_workout_id,
        nullif(v_ex->>'library_item_id', '')::uuid,
        coalesce(nullif(v_ex->>'kind', '')::exercise_kind, 'strength'),
        v_ex->>'title',
        v_ex->>'instructions',
        nullif(v_ex->>'sets', '')::int,
        v_ex->>'reps',
        nullif(v_ex->>'rest_seconds', '')::int,
        v_ex->>'load',
        v_ex->>'media_url',
        coalesce(nullif(v_ex->>'sort_order', '')::int, 0),
        coalesce((v_ex->>'is_optional')::boolean, false)
      );
    end loop;
  end loop;

  return jsonb_build_object('plan_id', v_plan_id);
end;
$$;
revoke execute on function public.create_plan_atomic(jsonb, jsonb) from public, anon;
grant  execute on function public.create_plan_atomic(jsonb, jsonb) to authenticated;

-- ── update_plan_atomic: rewrite a resting draft ──────────────
-- Replaces the plan's header fields and its whole workout tree in one
-- transaction. Only a plan still at draft or pending_review can be
-- rewritten; an active plan is edited by drafting anew, never in place.
-- SECURITY INVOKER: the caller's RLS decides what they can touch, so a
-- client cannot reach a coach's draft through this.
create or replace function public.update_plan_atomic(p_plan_id uuid, p_plan jsonb, p_workouts jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_status plan_status;
  v_workout jsonb;
  v_workout_id uuid;
  v_ex jsonb;
begin
  select status into v_status from public.training_plans where id = p_plan_id;
  if v_status is null then
    raise exception 'Plan not found or not accessible';
  end if;
  if v_status not in ('draft', 'pending_review') then
    raise exception 'Only a resting draft can be rewritten';
  end if;

  update public.training_plans
     set title          = p_plan->>'title',
         goal           = p_plan->>'goal',
         duration_weeks = nullif(p_plan->>'duration_weeks', '')::int,
         notes          = p_plan->>'notes',
         updated_at     = now()
   where id = p_plan_id;

  -- Replace the tree. Exercises cascade with their workouts. Client
  -- completions only ever point at active plans, so nothing is orphaned.
  delete from public.workouts where plan_id = p_plan_id;

  for v_workout in select * from jsonb_array_elements(coalesce(p_workouts, '[]'::jsonb))
  loop
    insert into public.workouts (org_id, plan_id, day_number, week_number, title, notes)
    values (
      v_org, p_plan_id,
      (v_workout->>'day_number')::int,
      (v_workout->>'week_number')::int,
      v_workout->>'title',
      v_workout->>'notes'
    )
    returning id into v_workout_id;

    for v_ex in select * from jsonb_array_elements(coalesce(v_workout->'exercises', '[]'::jsonb))
    loop
      insert into public.workout_exercises
        (org_id, workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional)
      values (
        v_org, v_workout_id,
        nullif(v_ex->>'library_item_id', '')::uuid,
        coalesce(nullif(v_ex->>'kind', '')::exercise_kind, 'strength'),
        v_ex->>'title',
        v_ex->>'instructions',
        nullif(v_ex->>'sets', '')::int,
        v_ex->>'reps',
        nullif(v_ex->>'rest_seconds', '')::int,
        v_ex->>'load',
        v_ex->>'media_url',
        coalesce(nullif(v_ex->>'sort_order', '')::int, 0),
        coalesce((v_ex->>'is_optional')::boolean, false)
      );
    end loop;
  end loop;

  return jsonb_build_object('plan_id', p_plan_id);
end;
$$;
revoke execute on function public.update_plan_atomic(uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.update_plan_atomic(uuid, jsonb, jsonb) to authenticated;

-- ── activate_plan_atomic: stamp the approval ─────────────────
create or replace function public.activate_plan_atomic(p_plan_id uuid)
returns void
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.training_plans where id = p_plan_id;
  if v_client is null then
    raise exception 'Plan not found or not accessible';
  end if;

  update public.training_plans
    set status = 'archived', updated_at = now()
  where client_id = v_client and id <> p_plan_id and status = 'active';

  -- The first activation is the approval; keep the first stamp on a
  -- re-activation so the record stays honest.
  update public.training_plans
    set status = 'active',
        coach_approved_at = coalesce(coach_approved_at, now()),
        coach_approved_by = coalesce(coach_approved_by, auth.uid()),
        updated_at = now()
  where id = p_plan_id;
end;
$$;
revoke execute on function public.activate_plan_atomic(uuid) from public, anon;
grant  execute on function public.activate_plan_atomic(uuid) to authenticated;

-- ── The leak fix: clients never read a resting draft ─────────
drop policy if exists "clients_read_own_training_plans" on training_plans;
create policy "clients_read_own_training_plans"
  on training_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
    and status not in ('draft', 'pending_review')
  );

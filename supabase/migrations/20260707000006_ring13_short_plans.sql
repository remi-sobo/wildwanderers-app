-- ============================================================
-- Wild Wanderers — Ring 13.4: short multi-day client plans
--
-- The 'short' third of the fork's plan_type shape, reserved in Ring
-- 11, comes alive: a client builds up to seven days in their own
-- lane. Same invariants as the single workout: initiated_by 'client',
-- resting status, the coach's plan never displaced (the Ring 11
-- activation guard and policies already cover any day count).
--
-- create_self_workout_atomic stays as a one-day wrapper so the Ring
-- 11 surface keeps working through any deploy gap.
-- ============================================================

create or replace function public.create_self_plan_atomic(p_title text, p_workouts jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_client uuid := (current_user_client_id())[1];
  v_count int := jsonb_array_length(coalesce(p_workouts, '[]'::jsonb));
  v_plan_id uuid;
  v_workout jsonb;
  v_workout_id uuid;
  v_ex jsonb;
  v_day int := 0;
begin
  if v_client is null then
    raise exception 'No client record for caller';
  end if;
  if v_count < 1 then
    raise exception 'A plan needs at least one day';
  end if;
  if v_count > 7 then
    raise exception 'A self-directed plan holds up to seven days';
  end if;

  insert into public.training_plans
    (org_id, client_id, coach_id, title, status, initiated_by, plan_type)
  values (
    v_org, v_client, null, p_title, 'draft', 'client',
    case when v_count = 1 then 'workout' else 'short' end
  )
  returning id into v_plan_id;

  for v_workout in select * from jsonb_array_elements(p_workouts)
  loop
    v_day := v_day + 1;
    insert into public.workouts (org_id, plan_id, day_number, week_number, title)
    values (
      v_org, v_plan_id,
      coalesce(nullif(v_workout->>'day_number', '')::int, v_day),
      1,
      coalesce(nullif(v_workout->>'title', ''), p_title)
    )
    returning id into v_workout_id;

    for v_ex in select * from jsonb_array_elements(coalesce(v_workout->'exercises', '[]'::jsonb))
    loop
      insert into public.workout_exercises
        (org_id, workout_id, library_item_id, kind, title, sets, reps, load, media_url, sort_order)
      values (
        v_org, v_workout_id,
        nullif(v_ex->>'library_item_id', '')::uuid,
        coalesce(nullif(v_ex->>'kind', '')::exercise_kind, 'strength'),
        v_ex->>'title',
        nullif(v_ex->>'sets', '')::int,
        v_ex->>'reps',
        v_ex->>'load',
        v_ex->>'media_url',
        coalesce(nullif(v_ex->>'sort_order', '')::int, 0)
      );
    end loop;
  end loop;

  return jsonb_build_object('plan_id', v_plan_id);
end;
$$;
revoke execute on function public.create_self_plan_atomic(text, jsonb) from public, anon;
grant  execute on function public.create_self_plan_atomic(text, jsonb) to authenticated;

-- The Ring 11 single-workout path, now a one-day wrapper.
create or replace function public.create_self_workout_atomic(p_title text, p_exercises jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
begin
  return public.create_self_plan_atomic(
    p_title,
    jsonb_build_array(jsonb_build_object(
      'title', p_title,
      'day_number', 1,
      'exercises', coalesce(p_exercises, '[]'::jsonb)
    ))
  );
end;
$$;
revoke execute on function public.create_self_workout_atomic(text, jsonb) from public, anon;
grant  execute on function public.create_self_workout_atomic(text, jsonb) to authenticated;

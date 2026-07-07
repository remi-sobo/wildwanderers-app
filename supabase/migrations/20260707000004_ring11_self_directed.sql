-- ============================================================
-- Wild Wanderers — Ring 11: self-directed client workouts
--
-- Ring 10's Phase C, forked from Team Esface
-- (20260601000011_self_directed_training.sql), retargeted athlete to
-- client, WITHOUT the client AI path: a client assembles their own
-- workout by hand from the movement library. Scout never serves a
-- client (Coach AI guardrail), so the fork's ai-generation columns are
-- not carried onto this path.
--
-- What a self-directed plan is here: plan_type 'workout',
-- initiated_by 'client', resting at 'draft' (or 'pending_review' when
-- the client asks Gabe to look). It is never the client's active plan:
-- activation stays a coach act on coach plans, enforced in
-- activate_plan_atomic below, and the client update policy locks
-- status to the two resting states.
--
-- duration_weeks is already nullable in this schema (the fork's relax
-- step is a no-op here). Ring 10 already added initiated_by,
-- coach_approved_at/by, and 'pending_review'.
-- ============================================================

-- What kind of plan this is. Coach plans stay 'transformation'; a
-- client's own single session is 'workout'. 'short' is reserved for
-- multi-day client plans later (fork kept the three-way shape).
alter table training_plans
  add column if not exists plan_type text not null default 'transformation'
    check (plan_type in ('workout', 'short', 'transformation'));

create index if not exists idx_training_plans_self_directed
  on training_plans (client_id, initiated_by, plan_type);

-- ── activate_plan_atomic: never a client's own workout ───────
-- Activating archives the client's current active plan. A self-directed
-- workout must never do that, from any surface, so the guard lives in
-- the database, not just the UI.
create or replace function public.activate_plan_atomic(p_plan_id uuid)
returns void
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_client uuid;
  v_initiated user_role;
begin
  select client_id, initiated_by into v_client, v_initiated
  from public.training_plans where id = p_plan_id;
  if v_client is null then
    raise exception 'Plan not found or not accessible';
  end if;
  if v_initiated = 'client' then
    raise exception 'A client''s own workout stays theirs; it is not activated as their plan';
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

-- ── create_self_workout_atomic: the client's own workout ─────
-- One resting plan with one workout, built from the movement library.
-- SECURITY INVOKER: the caller's own RLS governs every insert, so only
-- a client writing their own rows passes.
create or replace function public.create_self_workout_atomic(p_title text, p_exercises jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_client uuid := (current_user_client_id())[1];
  v_plan_id uuid;
  v_workout_id uuid;
  v_ex jsonb;
begin
  if v_client is null then
    raise exception 'No client record for caller';
  end if;

  insert into public.training_plans
    (org_id, client_id, coach_id, title, status, initiated_by, plan_type)
  values (v_org, v_client, null, p_title, 'draft', 'client', 'workout')
  returning id into v_plan_id;

  insert into public.workouts (org_id, plan_id, day_number, week_number, title)
  values (v_org, v_plan_id, 1, 1, p_title)
  returning id into v_workout_id;

  for v_ex in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
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

  return jsonb_build_object('plan_id', v_plan_id);
end;
$$;
revoke execute on function public.create_self_workout_atomic(text, jsonb) from public, anon;
grant  execute on function public.create_self_workout_atomic(text, jsonb) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY — the client's self-directed lane
-- (fork of athletes_create/update_self_directed_plans, minus parent)
-- ============================================================

-- Read: own finished-or-active plans as before, PLUS own self-directed
-- plans in any state. Coach drafts stay invisible: the resting-state
-- carve-out applies only to what the client started themselves.
drop policy if exists "clients_read_own_training_plans" on training_plans;
create policy "clients_read_own_training_plans"
  on training_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
    and (initiated_by = 'client' or status not in ('draft', 'pending_review'))
  );

create policy "clients_create_self_directed_plans"
  on training_plans for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and initiated_by = 'client'
    and client_id = any (current_user_client_id())
    and status in ('draft', 'pending_review')
  );

-- Update covers rename and send-to-coach. Status is locked to the two
-- resting states so a client can never activate their own workout, and
-- initiated_by is locked so a plan never changes lanes.
create policy "clients_update_own_self_directed_plans"
  on training_plans for update
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and initiated_by = 'client'
    and client_id = any (current_user_client_id())
  )
  with check (
    org_id = get_user_org()
    and initiated_by = 'client'
    and client_id = any (current_user_client_id())
    and status in ('draft', 'pending_review')
  );

create policy "clients_delete_own_self_directed_plans"
  on training_plans for delete
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and initiated_by = 'client'
    and client_id = any (current_user_client_id())
    and status in ('draft', 'pending_review')
  );

-- The workout tree under a self-directed plan. The subqueries run under
-- the client's own RLS, so "initiated_by = 'client'" can only ever match
-- their own plans; a coach plan (even their own active one) never passes.
create policy "clients_manage_own_self_workouts"
  on workouts for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and plan_id in (select id from training_plans where initiated_by = 'client')
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and plan_id in (select id from training_plans where initiated_by = 'client')
  );

create policy "clients_manage_own_self_workout_exercises"
  on workout_exercises for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and workout_id in (
      select w.id from workouts w
      where w.plan_id in (select id from training_plans where initiated_by = 'client')
    )
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and workout_id in (
      select w.id from workouts w
      where w.plan_id in (select id from training_plans where initiated_by = 'client')
    )
  );

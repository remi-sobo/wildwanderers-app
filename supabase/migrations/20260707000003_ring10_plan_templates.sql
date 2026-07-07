-- ============================================================
-- Wild Wanderers — Ring 10.3: plan templates
--
-- A per-org library of saved, client-agnostic plans, so Gabe builds
-- "Foundations" once and starts any client's plan from it. Net-new:
-- neither Team Esface nor this app had a template concept (checked
-- against the reference migrations before writing this).
--
-- Dedicated tables rather than a template flag on training_plans, on
-- purpose: the client-facing plan tables and their RLS stay untouched,
-- and a client can never reach a template because no client policy
-- exists at all. A single-workout template is a template with one
-- workout; one shape serves the saved workout and the saved plan.
--
-- Instantiating a template goes through the existing create_plan_atomic
-- and lands as a resting draft, so template -> draft -> review ->
-- activate is one path.
-- ============================================================

create table plan_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  title text not null,
  goal text,
  duration_weeks int,
  notes text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_plan_templates_org on plan_templates (org_id, is_active);

create table template_workouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  template_id uuid references plan_templates(id) on delete cascade not null,
  day_number int not null,
  week_number int not null,
  title text,
  notes text,
  created_at timestamptz default now(),
  unique (template_id, day_number)
);
create index idx_template_workouts_template on template_workouts (template_id);

create table template_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  template_workout_id uuid references template_workouts(id) on delete cascade not null,
  library_item_id uuid references exercise_library(id) on delete set null,
  kind exercise_kind not null default 'strength',
  title text not null,
  instructions text,
  sets int,
  reps text,
  rest_seconds int,
  load text,
  media_url text,
  sort_order int not null,
  is_optional boolean not null default false,
  created_at timestamptz default now()
);
create index idx_template_workout_exercises_workout
  on template_workout_exercises (template_workout_id);

-- ── Save a whole template in one transaction ─────────────────
-- Mirrors create_plan_atomic. SECURITY INVOKER: the caller's RLS
-- governs every insert, so only owner/coach can write.
create or replace function public.save_plan_template_atomic(p_template jsonb, p_workouts jsonb)
returns jsonb
language plpgsql security invoker volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_template_id uuid;
  v_workout jsonb;
  v_workout_id uuid;
  v_ex jsonb;
begin
  insert into public.plan_templates (org_id, title, goal, duration_weeks, notes, created_by)
  values (
    v_org,
    p_template->>'title',
    p_template->>'goal',
    nullif(p_template->>'duration_weeks', '')::int,
    p_template->>'notes',
    auth.uid()
  )
  returning id into v_template_id;

  for v_workout in select * from jsonb_array_elements(coalesce(p_workouts, '[]'::jsonb))
  loop
    insert into public.template_workouts (org_id, template_id, day_number, week_number, title, notes)
    values (
      v_org, v_template_id,
      (v_workout->>'day_number')::int,
      (v_workout->>'week_number')::int,
      v_workout->>'title',
      v_workout->>'notes'
    )
    returning id into v_workout_id;

    for v_ex in select * from jsonb_array_elements(coalesce(v_workout->'exercises', '[]'::jsonb))
    loop
      insert into public.template_workout_exercises
        (org_id, template_workout_id, library_item_id, kind, title, instructions, sets, reps, rest_seconds, load, media_url, sort_order, is_optional)
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

  return jsonb_build_object('template_id', v_template_id);
end;
$$;
revoke execute on function public.save_plan_template_atomic(jsonb, jsonb) from public, anon;
grant  execute on function public.save_plan_template_atomic(jsonb, jsonb) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY — staff only, no client policy at all
-- ============================================================

alter table plan_templates             enable row level security;
alter table template_workouts          enable row level security;
alter table template_workout_exercises enable row level security;

create policy "staff_manage_plan_templates"
  on plan_templates for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- Children delegate visibility to their parent, like workouts -> plan.
create policy "staff_manage_template_workouts"
  on template_workouts for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and template_id in (select id from plan_templates))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and template_id in (select id from plan_templates));

create policy "staff_manage_template_workout_exercises"
  on template_workout_exercises for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and template_workout_id in (select id from template_workouts))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and template_workout_id in (select id from template_workouts));

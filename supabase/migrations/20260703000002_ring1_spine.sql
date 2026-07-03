-- ============================================================
-- Wild Wanderers — Ring 1 Spine
--
-- Forks the Team Esface plan engine, scheduling, and messaging,
-- retargeted from sport to wellness. Uses the Ring 0 patterns: org_id
-- on every row, SECURITY DEFINER helpers instead of recursive inline
-- subselects, flat role checks, delegation for child tables.
--
-- Tables: training_plans, workouts, workout_exercises,
--         exercise_completions, sessions, message_threads, messages.
-- Helpers: current_user_group_ids(), touch_message_thread(),
--          mark_thread_messages_read().
-- RPCs: create_plan_atomic(), activate_plan_atomic().
-- RLS on every table. Realtime on messages.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type plan_status as enum ('draft', 'active', 'completed', 'archived');
create type session_kind as enum ('training', 'check_in', 'consult', 'group');
create type exercise_kind as enum ('strength', 'cardio', 'mobility', 'warmup', 'cooldown', 'skill');

-- ── training_plans (was transformation_plans) ──────────────
create table training_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  coach_id uuid references profiles(id),
  title text not null,
  goal text,
  status plan_status not null default 'draft',
  start_date date,
  end_date date,
  duration_weeks int,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- One active plan per client, enforced by the database.
create unique index training_plans_one_active_per_client
  on training_plans (client_id) where status = 'active';

-- ── workouts (was plan_days) ───────────────────────────────
create table workouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  plan_id uuid references training_plans(id) on delete cascade not null,
  day_number int not null,
  week_number int not null,
  title text,
  notes text,
  created_at timestamptz default now(),
  unique (plan_id, day_number)
);

-- ── workout_exercises (was plan_activities) ────────────────
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  workout_id uuid references workouts(id) on delete cascade not null,
  library_item_id uuid,                     -- future exercise library
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

-- ── exercise_completions (was activity_completions) ────────
create table exercise_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  workout_exercise_id uuid references workout_exercises(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  completed_at timestamptz default now(),
  notes text,
  unique (workout_exercise_id, client_id)
);

-- ── sessions (was schedule_events) ─────────────────────────
create table sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id),
  client_id uuid references clients(id) on delete cascade,  -- 1:1 session
  group_id uuid references groups(id) on delete cascade,    -- group class
  title text not null,
  kind session_kind not null default 'training',
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  notes text,
  is_cancelled boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── message_threads ────────────────────────────────────────
create table message_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  last_message_at timestamptz default now(),
  last_message_preview text,
  created_at timestamptz default now(),
  unique (coach_id, client_id)
);

-- ── messages ───────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  thread_id uuid references message_threads(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  sender_role user_role not null,
  content text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ── Indexes ────────────────────────────────────────────────
create index idx_training_plans_client on training_plans (client_id);
create index idx_training_plans_org on training_plans (org_id);
create index idx_workouts_plan on workouts (plan_id);
create index idx_workouts_org on workouts (org_id);
create index idx_workout_exercises_workout on workout_exercises (workout_id);
create index idx_workout_exercises_org on workout_exercises (org_id);
create index idx_exercise_completions_client on exercise_completions (client_id);
create index idx_exercise_completions_exercise on exercise_completions (workout_exercise_id);
create index idx_exercise_completions_org on exercise_completions (org_id);
create index idx_sessions_org on sessions (org_id);
create index idx_sessions_client on sessions (client_id);
create index idx_sessions_group on sessions (group_id);
create index idx_sessions_start on sessions (start_at);
create index idx_message_threads_coach on message_threads (coach_id, last_message_at desc);
create index idx_message_threads_client on message_threads (client_id);
create index idx_messages_thread on messages (thread_id, created_at);
create index idx_messages_org on messages (org_id);

-- ============================================================
-- HELPERS
-- ============================================================

-- The caller's group ids, recursion-safe (definer), mirroring the Ring 0
-- current_user_client_id() helper.
create or replace function public.current_user_group_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(cg.group_id), '{}'::uuid[])
  from public.client_groups cg
  join public.clients c on c.id = cg.client_id
  where c.user_id = auth.uid();
$$;
revoke execute on function public.current_user_group_ids() from public, anon;
grant  execute on function public.current_user_group_ids() to authenticated;

-- Roll the latest message up onto its thread. Definer so a client's insert can
-- update the thread it does not otherwise own. Trigger-only (execute revoked).
create or replace function public.touch_message_thread()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  update public.message_threads
    set last_message_at = new.created_at,
        last_message_preview = left(new.content, 140)
  where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function public.touch_message_thread() from public, anon, authenticated;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.touch_message_thread();

-- Mark the other party's unread messages read. Definer so recipients need no
-- write grant on messages; verifies the caller is a thread participant.
create or replace function public.mark_thread_messages_read(p_thread_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  is_participant boolean;
begin
  select exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id
      and (t.coach_id = auth.uid() or t.client_id = any (public.current_user_client_id()))
  ) into is_participant;

  if not is_participant then
    raise exception 'not a participant of this thread';
  end if;

  update public.messages
    set is_read = true, read_at = coalesce(read_at, now())
  where thread_id = p_thread_id
    and sender_id <> auth.uid()
    and is_read = false;
end;
$$;
revoke execute on function public.mark_thread_messages_read(uuid) from public, anon;
grant  execute on function public.mark_thread_messages_read(uuid) to authenticated;

-- ============================================================
-- RPCs (SECURITY INVOKER: the caller's own RLS governs every write)
-- ============================================================

-- Build a whole plan (plan + workouts + exercises) in one transaction. Status
-- is forced to 'draft'; activation is a separate audited step.
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
    (org_id, client_id, coach_id, title, goal, status, start_date, end_date, duration_weeks, notes)
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
    p_plan->>'notes'
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

-- Activate a plan: archive the client's currently active plan, then set this one
-- active, in one transaction so the one-active index never strands a client.
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

  update public.training_plans
    set status = 'active', updated_at = now()
  where id = p_plan_id;
end;
$$;
revoke execute on function public.activate_plan_atomic(uuid) from public, anon;
grant  execute on function public.activate_plan_atomic(uuid) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table training_plans      enable row level security;
alter table workouts            enable row level security;
alter table workout_exercises   enable row level security;
alter table exercise_completions enable row level security;
alter table sessions            enable row level security;
alter table message_threads     enable row level security;
alter table messages            enable row level security;

-- ── training_plans ─────────────────────────────────────────
create policy "staff_manage_training_plans"
  on training_plans for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_training_plans"
  on training_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  );

-- ── workouts (delegate visibility to the plan) ─────────────
create policy "staff_manage_workouts"
  on workouts for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and plan_id in (select id from training_plans))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and plan_id in (select id from training_plans));

create policy "clients_read_workouts"
  on workouts for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and plan_id in (select id from training_plans));

-- ── workout_exercises (delegate to the workout) ────────────
create policy "staff_manage_workout_exercises"
  on workout_exercises for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and workout_id in (select id from workouts))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and workout_id in (select id from workouts));

create policy "clients_read_workout_exercises"
  on workout_exercises for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and workout_id in (select id from workouts));

-- ── exercise_completions ───────────────────────────────────
create policy "clients_manage_own_completions"
  on exercise_completions for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_completions"
  on exercise_completions for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── sessions ───────────────────────────────────────────────
create policy "staff_manage_sessions"
  on sessions for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_sessions"
  on sessions for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and (
      client_id = any (current_user_client_id())
      or group_id = any (current_user_group_ids())
      or (client_id is null and group_id is null)
    )
  );

-- ── message_threads ────────────────────────────────────────
create policy "staff_manage_message_threads"
  on message_threads for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and coach_id = auth.uid())
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach')
         and coach_id = auth.uid());

create policy "clients_read_own_message_threads"
  on message_threads for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

-- ── messages ───────────────────────────────────────────────
create policy "staff_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and sender_id = auth.uid()
    and thread_id in (select id from message_threads where coach_id = auth.uid())
  );

create policy "staff_read_messages"
  on messages for select
  using (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and thread_id in (select id from message_threads where coach_id = auth.uid())
  );

create policy "clients_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org() and get_user_role() = 'client'
    and sender_id = auth.uid() and sender_role = 'client'
    and thread_id in (select id from message_threads where client_id = any (current_user_client_id()))
  );

create policy "clients_read_messages"
  on messages for select
  using (
    get_user_role() = 'client'
    and thread_id in (select id from message_threads)
  );

-- ── Realtime for the conversation ──────────────────────────
alter publication supabase_realtime add table messages;

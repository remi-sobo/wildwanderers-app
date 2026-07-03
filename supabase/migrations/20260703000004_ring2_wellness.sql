-- ============================================================
-- Wild Wanderers — Ring 2: the wellness tracker
--
-- The value none of the source apps have. Clients log weight,
-- measurements, habits, movement, and food from their phone; Progress
-- shows the graphs and a motivational wellness score; Gabe coaches off
-- real data on Fitness.
--
-- This ring holds sensitive health data, so the CLAUDE.md health-data
-- guardrails are load-bearing and lead the design:
--   * Consent before any body or food data is logged (consents table).
--   * Strict RLS on every body/food table, from this first migration:
--     a client reads and writes only their own; owner and coach read
--     within their org; no other client, no other org, ever.
--   * Privileged access is audited to a sealed ledger (audit_events),
--     forked from Team Esface: RLS on, zero policies, grants revoked,
--     service-role only.
--   * The wellness score is transparent and motivational, never medical.
--     Weighting locked: consistency 0.5, movement 0.25, habits 0.25.
--   * No column-level encryption this ring; we rely on Supabase at-rest
--     encryption plus the RLS and audit above (decision 3).
--
-- Uses the Ring 0/1 patterns: org_id on every row, SECURITY DEFINER
-- helpers instead of recursive subselects, flat role checks.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type consent_kind   as enum ('health_tracking');
create type habit_cadence  as enum ('daily', 'weekly');
create type activity_source as enum ('manual', 'import');
create type meal_kind      as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type check_in_kind  as enum ('text', 'voice');
create type check_in_status as enum ('open', 'reviewed', 'archived');

-- ============================================================
-- CONSENT
-- One row when a client accepts tracking. Nothing body/food is written
-- until a matching consent exists (enforced in the app's consent gate).
-- ============================================================
create table consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  kind consent_kind not null default 'health_tracking',
  version text not null default 'v1',
  granted_at timestamptz not null default now(),
  granted_by uuid references profiles(id)
);
create index idx_consents_client on consents (client_id, kind);
create index idx_consents_org on consents (org_id);

-- ============================================================
-- MEASUREMENTS
-- Every metric nullable: log what you have. Drives the progress graphs.
-- ============================================================
create table measurements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  taken_at timestamptz not null default now(),
  weight_kg numeric(6, 2),
  waist_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  body_fat_pct numeric(4, 1),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_measurements_client on measurements (client_id, taken_at desc);
create index idx_measurements_org on measurements (org_id);

-- ============================================================
-- HABITS + HABIT LOGS
-- Gabe assigns habits; the client checks them off. Streaks are computed
-- from the logs, never stored denormalized.
-- ============================================================
create table habits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  title text not null,
  cadence habit_cadence not null default 'daily',
  target_per_week int not null default 7,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_habits_client on habits (client_id) where is_active;
create index idx_habits_org on habits (org_id);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  habit_id uuid references habits(id) on delete cascade not null,
  logged_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_on)
);
create index idx_habit_logs_client on habit_logs (client_id, logged_on desc);
create index idx_habit_logs_habit on habit_logs (habit_id, logged_on desc);
create index idx_habit_logs_org on habit_logs (org_id);

-- ============================================================
-- ACTIVITY LOGS
-- Movement the client did, logged by hand now, importable later.
-- ============================================================
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  kind text not null,
  duration_minutes int,
  estimated_energy_kcal int,
  source activity_source not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);
create index idx_activity_logs_client on activity_logs (client_id, logged_at desc);
create index idx_activity_logs_org on activity_logs (org_id);

-- ============================================================
-- FOOD ITEMS (nutrition-API cache) + FOOD LOGS
-- We do not build a food database. food_items caches lookups from the
-- nutrition API (USDA FoodData Central + Open Food Facts). Writes go
-- through the upsert_food_item() chokepoint so a client logging a meal
-- can cache without a table grant.
-- ============================================================
create table food_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  source text not null,             -- 'usda' | 'openfoodfacts' | 'manual'
  external_id text,                 -- provider id; null for manual
  name text not null,
  brand text,
  serving text,                     -- human label, e.g. '1 cup (240 g)'
  calories numeric(7, 2),
  protein_g numeric(6, 2),
  carb_g numeric(6, 2),
  fat_g numeric(6, 2),
  cached_at timestamptz not null default now(),
  unique (org_id, source, external_id)
);
create index idx_food_items_org_name on food_items (org_id, name);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  meal meal_kind not null default 'snack',
  food_item_id uuid references food_items(id),
  description text,                 -- kept even if the cache row is pruned
  quantity numeric(6, 2) not null default 1,
  calories numeric(7, 2),
  protein_g numeric(6, 2),
  carb_g numeric(6, 2),
  fat_g numeric(6, 2),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_food_logs_client on food_logs (client_id, logged_at desc);
create index idx_food_logs_org on food_logs (org_id);

-- ============================================================
-- WELLNESS SCORES
-- A transparent snapshot for the trend line. Never writable by a client;
-- written only by the definer function below.
-- ============================================================
create table wellness_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  computed_at timestamptz not null default now(),
  score int not null,               -- 0..100
  consistency int,                  -- component, 0..100, null if no data
  movement int,
  habits int,
  inputs jsonb not null default '{}'::jsonb
);
create index idx_wellness_scores_client on wellness_scores (client_id, computed_at desc);
create index idx_wellness_scores_org on wellness_scores (org_id);

-- ============================================================
-- CHECK-INS
-- Ring 2 captures text/voice check-ins; Coach AI structures them at
-- Ring 3 (the structured jsonb stays null until then).
-- ============================================================
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  kind check_in_kind not null default 'text',
  body text,
  voice_url text,
  structured jsonb,                 -- filled by Coach AI at Ring 3
  status check_in_status not null default 'open'
);
create index idx_check_ins_client on check_ins (client_id, created_at desc);
create index idx_check_ins_org on check_ins (org_id);

-- ============================================================
-- AUDIT LEDGER (sealed) — forked from Team Esface
-- 20260702000001_observability_ledger_audit.sql. Privileged reads and
-- writes of body/food data append a row via the admin chokepoint,
-- fire-and-forget. metadata holds field NAMES and primitive labels only,
-- NEVER values or user content. RLS on, zero policies, grants revoked:
-- the service role (which bypasses RLS) is the only reader and writer.
-- ============================================================
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  org_id uuid,
  action text not null,             -- e.g. 'measurement.create', 'fitness.view'
  entity_table text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb
);
create index idx_audit_events_entity on audit_events (entity_table, entity_id);
create index idx_audit_events_created on audit_events (created_at);

alter table audit_events enable row level security;
revoke all on table audit_events from public, anon, authenticated;

-- ============================================================
-- WELLNESS SCORE (transparent, motivational, never medical)
--
-- A 0..100 number from three components, each 0..100, then weighted:
--   consistency 0.5, movement 0.25, habits 0.25.
-- A component with no data is treated as absent and its weight is
-- redistributed across the present ones, so a client is never dinged for
-- a channel they have not started. If nothing is tracked yet the score
-- is null (the UI shows a friendly "start logging" state, not a zero).
--
--   consistency — completed required exercises / required exercises in
--                 the active plan.
--   movement    — logged activity minutes in the last 7 days against a
--                 150-minute weekly target (the standard guideline).
--   habits      — average check-off rate across active habits over the
--                 last 7 days, each capped at its weekly target.
--
-- SECURITY DEFINER so it can read across the client's data, guarded so a
-- caller only ever computes for a client they may already see: the
-- client themselves, or owner/coach within the same org.
-- ============================================================
create or replace function public.compute_wellness_score(p_client_id uuid)
returns jsonb
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_role user_role := get_user_role();
  v_consistency numeric;
  v_movement numeric;
  v_habits numeric;
  v_req_total int;
  v_req_done int;
  v_minutes int;
  v_target_min int := 150;
  v_habit_rate numeric;
  v_active_habits int;
  v_weight_sum numeric := 0;
  v_score_sum numeric := 0;
  v_score int;
begin
  select org_id into v_org from public.clients where id = p_client_id;
  if v_org is null then
    raise exception 'Client not found';
  end if;

  -- Access guard: self, or owner/coach in the same org.
  if not (
    p_client_id = any (current_user_client_id())
    or (v_role in ('owner', 'coach') and v_org = get_user_org())
  ) then
    raise exception 'Not permitted to view this client';
  end if;

  -- Consistency: required exercises done / required exercises, active plan.
  select
    count(*) filter (where not e.is_optional),
    count(*) filter (where not e.is_optional and c.id is not null)
  into v_req_total, v_req_done
  from public.training_plans p
  join public.workouts w on w.plan_id = p.id
  join public.workout_exercises e on e.workout_id = w.id
  left join public.exercise_completions c
    on c.workout_exercise_id = e.id and c.client_id = p_client_id
  where p.client_id = p_client_id and p.status = 'active';

  if coalesce(v_req_total, 0) > 0 then
    v_consistency := round(100.0 * v_req_done / v_req_total);
  else
    v_consistency := null;
  end if;

  -- Movement: last 7 days minutes vs a 150-minute weekly target. Present
  -- once the client has ever logged an activity (they track movement).
  if exists (select 1 from public.activity_logs a where a.client_id = p_client_id) then
    select coalesce(sum(a.duration_minutes), 0) into v_minutes
    from public.activity_logs a
    where a.client_id = p_client_id
      and a.logged_at >= now() - interval '7 days';
    v_movement := least(100, round(100.0 * v_minutes / v_target_min));
  else
    v_movement := null;
  end if;

  -- Habits: average weekly check-off rate across active habits.
  select count(*) into v_active_habits
  from public.habits h where h.client_id = p_client_id and h.is_active;

  if v_active_habits > 0 then
    select avg(least(1.0, hits::numeric / greatest(h.target_per_week, 1)))
    into v_habit_rate
    from public.habits h
    left join lateral (
      select count(*) as hits
      from public.habit_logs l
      where l.habit_id = h.id
        and l.logged_on >= (now() at time zone 'utc')::date - 6
    ) g on true
    where h.client_id = p_client_id and h.is_active;
    v_habits := round(100 * coalesce(v_habit_rate, 0));
  else
    v_habits := null;
  end if;

  -- Weighted blend over the components that have data.
  if v_consistency is not null then
    v_weight_sum := v_weight_sum + 0.5;  v_score_sum := v_score_sum + 0.5 * v_consistency;
  end if;
  if v_movement is not null then
    v_weight_sum := v_weight_sum + 0.25; v_score_sum := v_score_sum + 0.25 * v_movement;
  end if;
  if v_habits is not null then
    v_weight_sum := v_weight_sum + 0.25; v_score_sum := v_score_sum + 0.25 * v_habits;
  end if;

  if v_weight_sum = 0 then
    v_score := null;
  else
    v_score := round(v_score_sum / v_weight_sum);
  end if;

  return jsonb_build_object(
    'score', v_score,
    'consistency', v_consistency,
    'movement', v_movement,
    'habits', v_habits,
    'inputs', jsonb_build_object(
      'required_exercises', coalesce(v_req_total, 0),
      'required_done', coalesce(v_req_done, 0),
      'movement_minutes_7d', coalesce(v_minutes, 0),
      'movement_target', v_target_min,
      'active_habits', coalesce(v_active_habits, 0)
    )
  );
end;
$$;
revoke execute on function public.compute_wellness_score(uuid) from public, anon;
grant  execute on function public.compute_wellness_score(uuid) to authenticated;

-- Write a snapshot for the trend line. Same access guard (via compute).
-- Definer insert bypasses the client's read-only RLS on wellness_scores.
create or replace function public.snapshot_wellness_score(p_client_id uuid)
returns jsonb
language plpgsql security definer volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_s jsonb := public.compute_wellness_score(p_client_id);
begin
  if v_s->>'score' is null then
    return v_s;  -- nothing to track yet
  end if;
  select org_id into v_org from public.clients where id = p_client_id;

  insert into public.wellness_scores
    (org_id, client_id, score, consistency, movement, habits, inputs)
  values (
    v_org, p_client_id,
    (v_s->>'score')::int,
    nullif(v_s->>'consistency', '')::int,
    nullif(v_s->>'movement', '')::int,
    nullif(v_s->>'habits', '')::int,
    v_s->'inputs'
  );
  return v_s;
end;
$$;
revoke execute on function public.snapshot_wellness_score(uuid) from public, anon;
grant  execute on function public.snapshot_wellness_score(uuid) to authenticated;

-- Cache a nutrition-API lookup so a client logging a meal can reuse it
-- without a direct write grant on food_items. Definer, org-scoped to the
-- caller. Returns the food_items id.
create or replace function public.upsert_food_item(
  p_source text, p_external_id text, p_name text, p_brand text,
  p_serving text, p_calories numeric, p_protein_g numeric,
  p_carb_g numeric, p_fat_g numeric
)
returns uuid
language plpgsql security definer volatile
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  v_id uuid;
begin
  if v_org is null then
    raise exception 'No org for caller';
  end if;

  insert into public.food_items
    (org_id, source, external_id, name, brand, serving, calories, protein_g, carb_g, fat_g, cached_at)
  values (v_org, p_source, nullif(p_external_id, ''), p_name, p_brand, p_serving,
          p_calories, p_protein_g, p_carb_g, p_fat_g, now())
  on conflict (org_id, source, external_id)
  do update set name = excluded.name, brand = excluded.brand, serving = excluded.serving,
                calories = excluded.calories, protein_g = excluded.protein_g,
                carb_g = excluded.carb_g, fat_g = excluded.fat_g, cached_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.upsert_food_item(text, text, text, text, text, numeric, numeric, numeric, numeric) from public, anon;
grant  execute on function public.upsert_food_item(text, text, text, text, text, numeric, numeric, numeric, numeric) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- Body/food/check-in tables: a client manages their own; owner and coach
-- read within their org; nobody cross-client or cross-org.
-- ============================================================
alter table consents        enable row level security;
alter table measurements    enable row level security;
alter table habits          enable row level security;
alter table habit_logs      enable row level security;
alter table activity_logs   enable row level security;
alter table food_items      enable row level security;
alter table food_logs       enable row level security;
alter table wellness_scores enable row level security;
alter table check_ins       enable row level security;

-- ── consents: a client grants and reads their own; staff read in org ──
create policy "clients_manage_own_consents"
  on consents for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_consents"
  on consents for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── measurements ───────────────────────────────────────────
create policy "clients_manage_own_measurements"
  on measurements for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_measurements"
  on measurements for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── habits: staff assign and manage; client reads their own ──
create policy "staff_manage_habits"
  on habits for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_habits"
  on habits for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

-- ── habit_logs: the client checks off their own; staff read in org ──
create policy "clients_manage_own_habit_logs"
  on habit_logs for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_habit_logs"
  on habit_logs for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── activity_logs ──────────────────────────────────────────
create policy "clients_manage_own_activity_logs"
  on activity_logs for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_activity_logs"
  on activity_logs for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── food_items (cache): org members read; writes via upsert_food_item ──
create policy "org_read_food_items"
  on food_items for select
  using (org_id = get_user_org());

create policy "staff_manage_food_items"
  on food_items for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── food_logs ──────────────────────────────────────────────
create policy "clients_manage_own_food_logs"
  on food_logs for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_food_logs"
  on food_logs for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── wellness_scores: read-only to clients (self) and staff (org);
--    writes only through snapshot_wellness_score() (definer) ──
create policy "clients_read_own_wellness_scores"
  on wellness_scores for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_wellness_scores"
  on wellness_scores for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── check_ins: a client creates and reads their own; staff read in org ──
create policy "clients_manage_own_check_ins"
  on check_ins for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

create policy "staff_read_check_ins"
  on check_ins for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- Staff may move a check-in's status (reviewed/archived) within org.
create policy "staff_update_check_ins"
  on check_ins for update
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

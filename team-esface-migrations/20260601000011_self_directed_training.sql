-- ============================================================
-- Team Esface — Self-Directed Training
-- Build order step 1 — database
--
-- Athletes and parents can create their own training (a one-time
-- workout, a short plan, or a full Transformation Plan) without
-- waiting for a coach to assign it. Coaches review, comment, suggest
-- swaps, and approve. This migration:
--
--   * Extends transformation_plans with self-directed metadata and
--     the AI generation_log.
--   * Relaxes duration_weeks so short plans / one-time workouts (which
--     are measured in days, not 2/3/5 week cycles) fit the same table.
--   * Adds plan_activity_comments (coach <-> family threads on a plan
--     or a single activity).
--   * Adds plan_activity_swaps (coach suggests a replacement activity;
--     athlete accepts or declines).
--   * Adds RLS so athletes/parents can create + read their own
--     self-directed plans, and scopes the two new tables to the people
--     in the athlete's circle.
-- ============================================================

-- ============================================================
-- TRANSFORMATION_PLANS — self-directed columns
-- ============================================================

-- Coach plans are 2 / 3 / 5 week cycles. Self-directed workouts are a
-- single session and short plans run 3–7 days, so duration_weeks can no
-- longer be NOT NULL or locked to {2,3,5}. Relax it to "null, or 1..5".
alter table transformation_plans
  drop constraint if exists transformation_plans_duration_weeks_check;

alter table transformation_plans
  alter column duration_weeks drop not null;

alter table transformation_plans
  add constraint transformation_plans_duration_weeks_check
  check (duration_weeks is null or duration_weeks between 1 and 5);

alter table transformation_plans
  add column if not exists initiated_by user_role not null default 'coach'
    check (initiated_by in ('coach', 'athlete', 'parent')),
  add column if not exists plan_type text not null default 'transformation'
    check (plan_type in ('workout', 'short', 'transformation')),
  add column if not exists athlete_goals text,
  add column if not exists has_gym_access boolean default true,
  add column if not exists available_equipment text[],
  add column if not exists session_duration_minutes int default 30,
  add column if not exists coach_approved boolean default false,
  add column if not exists coach_approved_at timestamptz,
  add column if not exists coach_approved_by uuid references profiles(id),
  add column if not exists coach_feedback text,
  -- true if ANY activity was Claude-generated rather than pulled from
  -- the knowledge base / drill bank.
  add column if not exists ai_generated_content boolean default false,
  -- { sources_used, kb_items_found, drill_bank_items_found,
  --   kb_items_used, drill_bank_items_used, claude_generated_count,
  --   fallback_generated_count, total_activities }
  add column if not exists generation_log jsonb;

-- Self-directed plans get submitted to the coach for an optional review.
-- 'pending_approval' already exists; add 'pending_review' so the two flows
-- (coach-built plan awaiting admin approval vs. self-directed plan awaiting
-- a coach's eyes) stay distinct in reporting.
alter type plan_status add value if not exists 'pending_review';

create index if not exists transformation_plans_self_directed_idx
  on transformation_plans (athlete_id, initiated_by, plan_type);

-- ============================================================
-- PLAN_ACTIVITY_COMMENTS
-- ============================================================

create table if not exists plan_activity_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references transformation_plans(id) on delete cascade not null,
  plan_activity_id uuid references plan_activities(id) on delete cascade,
    -- null = comment is on the whole plan, not one activity
  author_id uuid references profiles(id) not null,
  author_role user_role not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists plan_activity_comments_plan_idx
  on plan_activity_comments (plan_id, created_at);

alter table plan_activity_comments enable row level security;

-- ============================================================
-- PLAN_ACTIVITY_SWAPS
-- ============================================================
-- A coach suggests replacing an activity. The athlete (or parent)
-- accepts or declines. Acceptance is applied by the swap-respond route.

create type swap_status as enum ('pending', 'accepted', 'declined');

create table if not exists plan_activity_swaps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references transformation_plans(id) on delete cascade not null,
  original_activity_id uuid references plan_activities(id) on delete cascade,
  suggested_by uuid references profiles(id) not null,
  suggested_knowledge_base_item_id uuid references knowledge_base_items(id),
  suggested_title text,
  suggested_content text,
  reason text,
    -- coach's note: "try this instead for the gather step"
  status swap_status default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists plan_activity_swaps_plan_idx
  on plan_activity_swaps (plan_id, status);

alter table plan_activity_swaps enable row level security;

-- ============================================================
-- RLS — transformation_plans: athlete + parent self-directed writes
-- ============================================================
-- The existing day-5 policies let coaches write plans for their roster
-- and let athletes/parents READ their plans. Self-directed training adds
-- the ability for athletes and parents to CREATE (and update, e.g. submit
-- for review) their own self-directed plans. Coach-initiated plans are
-- already covered by the existing coach insert policy.

create policy "athletes_create_self_directed_plans"
  on transformation_plans for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and initiated_by = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create policy "athletes_update_own_self_directed_plans"
  on transformation_plans for update
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and initiated_by in ('athlete', 'parent')
    and athlete_id in (select id from athletes where user_id = auth.uid())
  )
  with check (
    org_id = get_user_org()
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create policy "parents_create_self_directed_plans"
  on transformation_plans for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and initiated_by = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "parents_update_child_self_directed_plans"
  on transformation_plans for update
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and initiated_by in ('athlete', 'parent')
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  )
  with check (
    org_id = get_user_org()
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

-- Coaches already read their roster's plans (day-5 policy) and can update
-- them — which covers approve / coach_feedback. Nothing new needed there.

-- ============================================================
-- RLS — plan_activity_comments
-- ============================================================
-- Visibility is inherited from the plan: if you can SELECT the plan
-- (admin / coach-roster / parent-child / athlete-own — all defined on
-- transformation_plans), you can see and add comments on it. Authors
-- can edit/delete their own comments.

create policy "admins_full_access_plan_activity_comments"
  on plan_activity_comments for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "circle_read_plan_activity_comments"
  on plan_activity_comments for select
  using (plan_id in (select id from transformation_plans));

create policy "circle_write_plan_activity_comments"
  on plan_activity_comments for insert
  with check (
    author_id = auth.uid()
    and plan_id in (select id from transformation_plans)
  );

create policy "authors_update_own_plan_activity_comments"
  on plan_activity_comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "authors_delete_own_plan_activity_comments"
  on plan_activity_comments for delete
  using (author_id = auth.uid());

-- ============================================================
-- RLS — plan_activity_swaps
-- ============================================================
-- Anyone who can see the plan can see its swaps. Only coaches create
-- swaps (for plans on their roster). The athlete/parent who owns the
-- plan responds (accept/decline) via UPDATE; the suggesting coach can
-- also update their own pending suggestion.

create policy "admins_full_access_plan_activity_swaps"
  on plan_activity_swaps for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "circle_read_plan_activity_swaps"
  on plan_activity_swaps for select
  using (plan_id in (select id from transformation_plans));

create policy "coaches_create_plan_activity_swaps"
  on plan_activity_swaps for insert
  with check (
    get_user_role() = 'coach'
    and suggested_by = auth.uid()
    and plan_id in (select id from transformation_plans)
  );

create policy "owners_respond_plan_activity_swaps"
  on plan_activity_swaps for update
  using (
    plan_id in (select id from transformation_plans)
    and (
      get_user_role() in ('athlete', 'parent')
      or suggested_by = auth.uid()
    )
  )
  with check (plan_id in (select id from transformation_plans));

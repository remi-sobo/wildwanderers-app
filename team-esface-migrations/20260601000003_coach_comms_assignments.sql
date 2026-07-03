-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase A · Migration 3 of 5 — coach assignments
--
--   coach_assignments     — a task or mini plan a coach assigns to an
--                           athlete or a whole team.
--   assignment_activities — the work items (DO / WATCH / THINK /
--                           REFLECT etc.), grouped by day for mini plans.
--   assignment_completions— per-athlete, per-activity completion records.
--
-- In V1 a coach mini plan stacks alongside the athlete's main
-- Transformation Plan — it does not replace it.
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────

create type assignment_target as enum ('athlete', 'team');
create type assignment_kind   as enum ('task', 'mini_plan');
create type assignment_status as enum ('active', 'completed', 'archived');

-- ─── Tables ───────────────────────────────────────────────────────

create table coach_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  target_type assignment_target not null,
  athlete_id uuid references athletes(id),   -- set when target_type = 'athlete'
  team_id uuid references teams(id),         -- set when target_type = 'team'
  kind assignment_kind not null,
  title text not null,
  description text,
  focus_pillar mbhs_pillar,
  focus_subcategory text,
  due_date date,
  duration_days int default 1,               -- 1 for a single task; 3/5/7 for mini plans
  status assignment_status default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- exactly one target must be populated, matching target_type
  check (
    (target_type = 'athlete' and athlete_id is not null and team_id is null)
    or (target_type = 'team' and team_id is not null and athlete_id is null)
  )
);

create table assignment_activities (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references coach_assignments(id) on delete cascade not null,
  day_number int not null default 1,
  activity_type activity_type not null,
  title text not null,
  content text,
  media_url text,
  knowledge_base_item_id uuid references knowledge_base_items(id),
  duration_minutes int default 10,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table assignment_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references coach_assignments(id) not null,
  assignment_activity_id uuid references assignment_activities(id),
  athlete_id uuid references athletes(id) not null,
  completed_at timestamptz default now(),
  reflection_notes text,
  unique (assignment_activity_id, athlete_id)
);

create index coach_assignments_coach_id_idx on coach_assignments (coach_id, status);
create index coach_assignments_athlete_id_idx on coach_assignments (athlete_id) where athlete_id is not null;
create index coach_assignments_team_id_idx on coach_assignments (team_id) where team_id is not null;
create index assignment_activities_assignment_id_idx on assignment_activities (assignment_id, day_number, sort_order);
create index assignment_completions_assignment_id_idx on assignment_completions (assignment_id);
create index assignment_completions_athlete_id_idx on assignment_completions (athlete_id);

-- ─── RLS ──────────────────────────────────────────────────────────

alter table coach_assignments      enable row level security;
alter table assignment_activities  enable row level security;
alter table assignment_completions enable row level security;

-- coach_assignments ───────────────────────────────────────────────

create policy "admins_full_access_coach_assignments"
  on coach_assignments for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_own_coach_assignments"
  on coach_assignments for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  );

create policy "athletes_read_own_coach_assignments"
  on coach_assignments for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and (
      (target_type = 'athlete' and athlete_id = current_user_athlete_id())
      or (target_type = 'team' and team_id = current_user_athlete_team_id())
    )
  );

create policy "parents_read_child_coach_assignments"
  on coach_assignments for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and (
      (target_type = 'athlete' and athlete_id = any (current_user_child_athlete_ids()))
      or (target_type = 'team' and team_id = any (current_user_child_team_ids()))
    )
  );

-- assignment_activities ───────────────────────────────────────────
-- No org column; scope through the parent assignment. The subquery
-- inherits coach_assignments RLS, so a row is visible iff its
-- assignment is visible to the caller.

create policy "admins_full_access_assignment_activities"
  on assignment_activities for all
  using (
    get_user_role() = 'admin'
    and assignment_id in (select id from coach_assignments where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and assignment_id in (select id from coach_assignments where org_id = get_user_org())
  );

create policy "coaches_write_assignment_activities"
  on assignment_activities for all
  using (
    get_user_role() = 'coach'
    and assignment_id in (select id from coach_assignments where coach_id = auth.uid())
  )
  with check (
    get_user_role() = 'coach'
    and assignment_id in (select id from coach_assignments where coach_id = auth.uid())
  );

create policy "members_read_assignment_activities"
  on assignment_activities for select
  using (
    get_user_role() in ('athlete', 'parent')
    and assignment_id in (select id from coach_assignments)
  );

-- assignment_completions ──────────────────────────────────────────

create policy "admins_read_assignment_completions"
  on assignment_completions for select
  using (
    get_user_role() = 'admin'
    and assignment_id in (select id from coach_assignments where org_id = get_user_org())
  );

create policy "coaches_read_assignment_completions"
  on assignment_completions for select
  using (
    get_user_role() = 'coach'
    and assignment_id in (select id from coach_assignments where coach_id = auth.uid())
  );

-- Athletes log their own completions and can read them back.
create policy "athletes_write_own_completions"
  on assignment_completions for insert
  with check (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
    and assignment_id in (select id from coach_assignments)
  );

create policy "athletes_read_own_completions"
  on assignment_completions for select
  using (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  );

create policy "parents_read_child_completions"
  on assignment_completions for select
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

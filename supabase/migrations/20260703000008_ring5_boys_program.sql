-- ============================================================
-- Wild Wanderers — Ring 5: the boys program ("Dads & Kids")
--
-- Running the boys program the way a nonprofit runs an after-school
-- program, minus impact, evaluation, and fundraising. Forks the Team
-- Esface camp module, retargeted: camps -> programs, camp_groups ->
-- cohorts, campers -> participants, camp_schedule_events -> sessions,
-- camp_attendance stays attendance. The camp_evaluations scoring engine
-- and all impact/fundraising machinery are dropped on purpose.
--
-- Guardrails:
--   * Kids are minors. Participant records and parent contact are
--     org-scoped and staff-only (owner, coach) from this first migration.
--     A parent, once invited, reads only their own kids' schedule,
--     attendance, and badges. No client reads any of it.
--   * No fabricated content. Programs and participants are only ever what
--     Gabe enters. We seed only the badge catalog (configuration).
--   * No evaluation or scoring. A badge is a warm note, never a grade.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type program_status as enum ('setup', 'active', 'completed', 'archived');
create type program_coach_role as enum ('lead', 'coach');
create type participant_status as enum ('active', 'inactive');
create type attendance_status as enum ('present', 'absent', 'late');

-- ── programs (was camps) ───────────────────────────────────
create table programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  status program_status not null default 'setup',
  location text,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_org_idx on programs (org_id, status);

-- ── program_groups (cohorts) ───────────────────────────────
create table program_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create index program_groups_program_idx on program_groups (program_id);

-- ── program_coaches (staffing; a second coach later) ───────
create table program_coaches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  coach_id uuid references profiles(id) not null,
  group_id uuid references program_groups(id) on delete set null,
  role program_coach_role not null default 'coach',
  created_at timestamptz not null default now(),
  unique (program_id, coach_id)
);
create index program_coaches_coach_idx on program_coaches (coach_id);

-- ── participants (the kids) ────────────────────────────────
-- Minors, no login. parent_user_id links the family-facing login once a
-- parent is invited and claims it.
create table participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  group_id uuid references program_groups(id) on delete set null,
  parent_user_id uuid references profiles(id),
  first_name text not null,
  last_name text not null,
  grade int check (grade between 1 and 12),
  parent_name text,
  parent_email text,
  parent_phone text,
  photo_url text,
  status participant_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index participants_program_idx on participants (program_id);
create index participants_group_idx on participants (group_id);
create index participants_parent_idx on participants (parent_user_id);

-- ── program_sessions (the schedule) ────────────────────────
create table program_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  group_id uuid references program_groups(id) on delete set null,
  title text not null,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index program_sessions_program_idx on program_sessions (program_id, starts_at);

-- ── attendance ─────────────────────────────────────────────
create table attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  session_id uuid references program_sessions(id) on delete cascade not null,
  participant_id uuid references participants(id) on delete cascade not null,
  status attendance_status not null default 'present',
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id)
);
create index attendance_session_idx on attendance (session_id);
create index attendance_participant_idx on attendance (participant_id);

-- ── badges (catalog) + awards ──────────────────────────────
create table program_badges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  emoji text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index program_badges_org_idx on program_badges (org_id);

create table participant_badges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  participant_id uuid references participants(id) on delete cascade not null,
  badge_id uuid references program_badges(id) on delete cascade not null,
  note text,
  awarded_by uuid references profiles(id),
  awarded_at timestamptz not null default now()
);
create index participant_badges_participant_idx on participant_badges (participant_id);

-- ============================================================
-- HELPERS (definer, recursion-safe) for the family-facing reads
-- ============================================================
create or replace function public.current_user_participant_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.participants where parent_user_id = auth.uid();
$$;
revoke execute on function public.current_user_participant_ids() from public, anon;
grant  execute on function public.current_user_participant_ids() to authenticated;

create or replace function public.current_user_child_program_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(distinct program_id), '{}'::uuid[])
  from public.participants where parent_user_id = auth.uid();
$$;
revoke execute on function public.current_user_child_program_ids() from public, anon;
grant  execute on function public.current_user_child_program_ids() to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- Staff (owner, coach) manage everything within their org. A parent reads
-- only their own kids' program, cohort, sessions, attendance, and badges.
-- ============================================================
alter table programs           enable row level security;
alter table program_groups     enable row level security;
alter table program_coaches    enable row level security;
alter table participants       enable row level security;
alter table program_sessions   enable row level security;
alter table attendance         enable row level security;
alter table program_badges     enable row level security;
alter table participant_badges enable row level security;

-- programs
create policy "staff_manage_programs" on programs for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_programs" on programs for select
  using (get_user_role() = 'parent' and id = any (current_user_child_program_ids()));

-- program_groups
create policy "staff_manage_program_groups" on program_groups for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_groups" on program_groups for select
  using (get_user_role() = 'parent' and program_id = any (current_user_child_program_ids()));

-- program_coaches (staff only)
create policy "staff_manage_program_coaches" on program_coaches for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- participants
create policy "staff_manage_participants" on participants for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_own_children" on participants for select
  using (get_user_role() = 'parent' and parent_user_id = auth.uid());

-- program_sessions
create policy "staff_manage_program_sessions" on program_sessions for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_sessions" on program_sessions for select
  using (get_user_role() = 'parent' and program_id = any (current_user_child_program_ids()));

-- attendance
create policy "staff_manage_attendance" on attendance for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_attendance" on attendance for select
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- program_badges (catalog): org members read; staff manage.
create policy "org_reads_program_badges" on program_badges for select
  using (org_id = get_user_org());
create policy "staff_manage_program_badges" on program_badges for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- participant_badges
create policy "staff_manage_participant_badges" on participant_badges for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_badges" on participant_badges for select
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- ============================================================
-- SEED — the badge catalog only (configuration, clearly named). No kids,
-- no programs; those are Gabe's real data.
-- ============================================================
insert into program_badges (org_id, name, emoji, description, sort_order)
select o.id, x.name, x.emoji, x.descr, x.ord
from public.organizations o,
  (values
    ('First Day', '🌱', 'Showed up and jumped in on day one.', 0),
    ('Great Teammate', '🤝', 'Looked out for the group.', 1),
    ('Showed Up', '🔥', 'Steady attendance, week after week.', 2),
    ('Strong Effort', '💪', 'Gave it everything today.', 3),
    ('Trail Leader', '🧭', 'Led the way and set the tone.', 4),
    ('Kind Heart', '💚', 'Went out of the way to help.', 5)
  ) as x(name, emoji, descr, ord)
where o.slug = 'wild-wanderers-fitness'
on conflict (org_id, name) do nothing;

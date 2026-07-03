-- ============================================================
-- Team Esface — Camp Module + Scoped Access Architecture
-- Camp Module · Foundation
--
-- Introduces the summer camp experience and the scope layer that
-- decides what each user sees based on what they are ENROLLED in
-- (never a toggle). A camp-only user simply sees less; when their
-- enrollment grows, their access grows automatically.
--
-- New enums:
--   camp_status   (setup | active | completed | archived)
--   user_scope    (camp_only | season_only | full)
--
-- New tables:
--   camps                      — a camp instance (a week of work)
--   camp_groups                — groups within a camp (e.g. "Group A")
--   camp_coaches               — coach assignment to a camp / group
--   campers                    — a kid at camp; one shared family login
--   camp_evaluations           — MBHS evaluation for a camper
--   camp_milestone_definitions — catalog of camp badges
--   camper_milestones          — badges a camper has earned
--   camp_coach_feedback        — family rates their camp coach
--
-- Scope helper:
--   get_user_scope(uuid) — computes camp_only | season_only | full
--   from a user's enrollments. Computed, never stored.
--
-- RLS uses the existing SECURITY DEFINER helpers
--   get_user_role(), get_user_org(), auth.uid(), auth.email()
-- plus three new camp helpers defined below.
-- ============================================================

-- ── Enum types ──────────────────────────────────────────────
create type camp_status as enum ('setup', 'active', 'completed', 'archived');
create type user_scope  as enum ('camp_only', 'season_only', 'full');

-- ─────────────────────────────────────────────────────────────
-- camps
-- ─────────────────────────────────────────────────────────────
-- A single camp instance. `status` gates whether the camp counts
-- toward a user's camp scope: setup/active/completed do, archived
-- does not (it has rolled off).
create table camps (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) not null,
  name        text not null,
  status      camp_status not null default 'setup',
  location    text,
  start_date  date,
  end_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index camps_org_idx on camps (org_id, status);

-- ─────────────────────────────────────────────────────────────
-- camp_groups
-- ─────────────────────────────────────────────────────────────
-- A coachable group within a camp. Campers and coaches are assigned
-- to a group so the week is organised into small cohorts.
create table camp_groups (
  id         uuid primary key default gen_random_uuid(),
  camp_id    uuid references camps(id) on delete cascade not null,
  name       text not null,
  color      text,
  created_at timestamptz default now()
);

create index camp_groups_camp_idx on camp_groups (camp_id);

-- ─────────────────────────────────────────────────────────────
-- camp_coaches
-- ─────────────────────────────────────────────────────────────
-- Assigns a coach to a camp (optionally to a specific group). A coach
-- with ONLY camp assignments computes to camp_only scope.
create table camp_coaches (
  id         uuid primary key default gen_random_uuid(),
  camp_id    uuid references camps(id) on delete cascade not null,
  coach_id   uuid references profiles(id) not null,
  group_id   uuid references camp_groups(id) on delete set null,
  role       text not null default 'coach' check (role in ('lead', 'coach')),
  created_at timestamptz default now(),
  unique (camp_id, coach_id)
);

create index camp_coaches_coach_idx on camp_coaches (coach_id);
create index camp_coaches_camp_idx  on camp_coaches (camp_id);

-- ─────────────────────────────────────────────────────────────
-- campers
-- ─────────────────────────────────────────────────────────────
-- A kid enrolled in a camp. For camp the parent and kid share ONE
-- login, controlled by the parent:
--   * user_id      — the shared family login (null until claimed)
--   * parent_email — how a pre-existing parent profile is matched
-- On conversion to club a full athletes row is created and linked
-- via athlete_id, with converted_to_athlete flipped true. The camper
-- row is retained so the development story stays continuous.
create table campers (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid references organizations(id) not null,
  camp_id              uuid references camps(id) on delete cascade not null,
  group_id             uuid references camp_groups(id) on delete set null,
  user_id              uuid references profiles(id),
  parent_email         text not null,
  first_name           text not null,
  last_name            text not null,
  grade                int check (grade between 1 and 12),
  photo_url            text,
  athlete_id           uuid references athletes(id),
  converted_to_athlete boolean not null default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create index campers_camp_idx    on campers (camp_id);
create index campers_group_idx   on campers (group_id);
create index campers_user_idx    on campers (user_id);
create index campers_email_idx   on campers (lower(parent_email));
create index campers_athlete_idx on campers (athlete_id);

-- ─────────────────────────────────────────────────────────────
-- camp_evaluations
-- ─────────────────────────────────────────────────────────────
-- The same MBHS engine as the season evaluation, scoped to a camper.
-- Column names mirror `evaluations` exactly so the shared display and
-- snapshot components read it without translation. On conversion this
-- row becomes the athlete's first evaluation — chapter one of history.
create table camp_evaluations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) not null,
  camp_id     uuid references camps(id) on delete cascade not null,
  camper_id   uuid references campers(id) on delete cascade not null,
  coach_id    uuid references profiles(id) not null,
  status      evaluation_status not null default 'draft',

  -- MIND
  mind_iq               int check (mind_iq between 1 and 5),
  mind_next_play_speed  int check (mind_next_play_speed between 1 and 5),
  mind_focus            int check (mind_focus between 1 and 5),
  mind_anti_softness    int check (mind_anti_softness between 1 and 5),

  -- BODY — earned
  body_explosiveness    int check (body_explosiveness between 1 and 5),
  body_stability        int check (body_stability between 1 and 5),
  body_stamina          int check (body_stamina between 1 and 5),
  -- BODY — natural (displayed, not trained)
  body_speed            int check (body_speed between 1 and 5),
  body_length           int check (body_length between 1 and 5),

  -- HEART
  heart_humble_teammate  int check (heart_humble_teammate between 1 and 5),
  heart_humble_coachable int check (heart_humble_coachable between 1 and 5),
  heart_positive         int check (heart_positive between 1 and 5),
  heart_hunger           int check (heart_hunger between 1 and 5),

  -- SKILL
  skill_ball_handling    int check (skill_ball_handling between 1 and 5),
  skill_finishing        int check (skill_finishing between 1 and 5),
  skill_passing          int check (skill_passing between 1 and 5),
  skill_shooting         int check (skill_shooting between 1 and 5),
  skill_on_ball_defense  int check (skill_on_ball_defense between 1 and 5),
  skill_off_ball_defense int check (skill_off_ball_defense between 1 and 5),

  -- Top-line summary (pillar.subcategory slugs, same as season)
  primary_strength      text,
  secondary_strength    text,
  primary_opportunity   text,
  secondary_opportunity text,

  coach_note   text,

  created_at   timestamptz default now(),
  completed_at timestamptz,
  updated_at   timestamptz default now(),

  -- One evaluation per camper per camp.
  unique (camp_id, camper_id)
);

create index camp_evaluations_camper_idx on camp_evaluations (camper_id);
create index camp_evaluations_camp_idx   on camp_evaluations (camp_id);
create index camp_evaluations_coach_idx  on camp_evaluations (coach_id);

-- ─────────────────────────────────────────────────────────────
-- camp_milestone_definitions
-- ─────────────────────────────────────────────────────────────
-- Catalog of camp badges. `icon_name` maps to the shared milestone
-- icon registry on the client. Seeded per-org below.
create table camp_milestone_definitions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) not null,
  key         text not null,
  name        text not null,
  description text not null,
  icon_name   text,
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  unique (org_id, key)
);

create index camp_milestone_definitions_org_idx on camp_milestone_definitions (org_id);

-- ─────────────────────────────────────────────────────────────
-- camper_milestones
-- ─────────────────────────────────────────────────────────────
-- Badges a camper has earned. Idempotent per (camper, definition).
create table camper_milestones (
  id            uuid primary key default gen_random_uuid(),
  camper_id     uuid references campers(id) on delete cascade not null,
  definition_id uuid references camp_milestone_definitions(id) on delete cascade not null,
  earned_at     timestamptz default now(),
  awarded_by    uuid references profiles(id),
  note          text,
  unique (camper_id, definition_id)
);

create index camper_milestones_camper_idx on camper_milestones (camper_id);

-- ─────────────────────────────────────────────────────────────
-- camp_coach_feedback
-- ─────────────────────────────────────────────────────────────
-- A family rates their camp coach. Feeds the coach's "My Performance"
-- view. One rating per (camper, coach, camp).
create table camp_coach_feedback (
  id         uuid primary key default gen_random_uuid(),
  camp_id    uuid references camps(id) on delete cascade not null,
  camper_id  uuid references campers(id) on delete cascade not null,
  coach_id   uuid references profiles(id) not null,
  rating     int not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz default now(),
  unique (camper_id, coach_id, camp_id)
);

create index camp_coach_feedback_coach_idx on camp_coach_feedback (coach_id, camp_id);
create index camp_coach_feedback_camp_idx  on camp_coach_feedback (camp_id);

-- ── updated_at triggers ─────────────────────────────────────
create trigger camps_updated_at
  before update on camps
  for each row execute function set_updated_at();

create trigger campers_updated_at
  before update on campers
  for each row execute function set_updated_at();

create trigger camp_evaluations_updated_at
  before update on camp_evaluations
  for each row execute function set_updated_at();

-- ============================================================
-- SECURITY DEFINER helpers (camp)
-- Hide subselects from the RLS planner to avoid recursion and keep
-- policies fast. Pinned search_path, authenticated-only.
-- ============================================================

-- Camps where the current user is an assigned coach.
create or replace function public.current_user_coach_camp_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(camp_id), '{}'::uuid[])
  from public.camp_coaches
  where coach_id = auth.uid();
$$;

-- Campers belonging to the current family login — matched either by
-- the shared login (user_id) or by the parent's email.
create or replace function public.current_user_camper_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.campers
  where user_id = auth.uid()
     or lower(parent_email) = lower(auth.email());
$$;

-- Camps the current family login has a camper in (to read camp/groups).
create or replace function public.current_user_camp_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(distinct camp_id), '{}'::uuid[])
  from public.campers
  where user_id = auth.uid()
     or lower(parent_email) = lower(auth.email());
$$;

revoke execute on function public.current_user_coach_camp_ids() from public, anon;
revoke execute on function public.current_user_camper_ids()     from public, anon;
revoke execute on function public.current_user_camp_ids()       from public, anon;
grant  execute on function public.current_user_coach_camp_ids() to authenticated;
grant  execute on function public.current_user_camper_ids()     to authenticated;
grant  execute on function public.current_user_camp_ids()       to authenticated;

-- ============================================================
-- get_user_scope — the heart of the scope layer
-- Computes a user's scope from their enrollments. Never stored.
-- ============================================================
create or replace function public.get_user_scope(p_user_id uuid)
returns user_scope
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  has_season boolean := false;
  has_camp   boolean := false;
  v_role     user_role;
  v_email    text;
begin
  -- Guard: a user may only resolve their own scope (admins may resolve
  -- anyone's). The result is low-sensitivity, but no need to leak it.
  if p_user_id <> auth.uid()
     and (select role from public.profiles where id = auth.uid()) <> 'admin' then
    return null;
  end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then
    return null;
  end if;

  -- Admins see everything.
  if v_role = 'admin' then
    return 'full';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  if v_role = 'coach' then
    select exists (
      select 1 from public.coach_teams ct
      join public.teams t on t.id = ct.team_id
      where ct.coach_id = p_user_id and t.is_active
    ) into has_season;

    select exists (
      select 1 from public.camp_coaches cc
      join public.camps c on c.id = cc.camp_id
      where cc.coach_id = p_user_id
        and c.status in ('setup', 'active', 'completed')
    ) into has_camp;

  elsif v_role = 'parent' then
    select exists (
      select 1 from public.parent_athletes pa
      join public.athletes a on a.id = pa.athlete_id
      where pa.parent_id = p_user_id
        and a.current_team_id is not null
        and a.is_active
    ) into has_season;

    select exists (
      select 1 from public.campers cmp
      where cmp.user_id = p_user_id
         or lower(cmp.parent_email) = lower(v_email)
    ) into has_camp;

  elsif v_role = 'athlete' then
    select exists (
      select 1 from public.athletes a
      where a.user_id = p_user_id
        and a.current_team_id is not null
        and a.is_active
    ) into has_season;

    select exists (
      select 1 from public.campers cmp
      where cmp.user_id = p_user_id
         or lower(cmp.parent_email) = lower(v_email)
    ) into has_camp;
  end if;

  if has_season and has_camp then return 'full'; end if;
  if has_camp then return 'camp_only'; end if;
  if has_season then return 'season_only'; end if;

  -- Default: treat as a season user (no camp lock-in).
  return 'season_only';
end;
$$;

revoke execute on function public.get_user_scope(uuid) from public, anon;
grant  execute on function public.get_user_scope(uuid) to authenticated;

-- ============================================================
-- get_camper_coach — lets a family resolve their camp coach.
-- Families can't read camp_coaches/coach profiles directly (RLS), so
-- this definer function returns just the coach's name for the camper's
-- camp, gated to the camper's own family (or a coach of that camp/admin).
-- ============================================================
create or replace function public.get_camper_coach(p_camper_id uuid)
returns table (coach_id uuid, first_name text, last_name text)
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  v_camp_id uuid;
  v_allowed boolean;
begin
  select camp_id into v_camp_id from public.campers where id = p_camper_id;
  if v_camp_id is null then
    return;
  end if;

  select (
    p_camper_id = any (public.current_user_camper_ids())
    or v_camp_id = any (public.current_user_coach_camp_ids())
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  ) into v_allowed;

  if not v_allowed then
    return;
  end if;

  return query
    select cc.coach_id, p.first_name, p.last_name
    from public.camp_coaches cc
    join public.profiles p on p.id = cc.coach_id
    where cc.camp_id = v_camp_id
    order by case when cc.role = 'lead' then 0 else 1 end, cc.created_at
    limit 1;
end;
$$;

revoke execute on function public.get_camper_coach(uuid) from public, anon;
grant  execute on function public.get_camper_coach(uuid) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table camps                      enable row level security;
alter table camp_groups                enable row level security;
alter table camp_coaches               enable row level security;
alter table campers                    enable row level security;
alter table camp_evaluations           enable row level security;
alter table camp_milestone_definitions enable row level security;
alter table camper_milestones          enable row level security;
alter table camp_coach_feedback        enable row level security;

-- ── camps ────────────────────────────────────────────────────
create policy "admins_full_access_camps"
  on camps for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_assigned_camps"
  on camps for select
  using (get_user_role() = 'coach' and id = any (current_user_coach_camp_ids()));

create policy "family_read_own_camps"
  on camps for select
  using (id = any (current_user_camp_ids()));

-- ── camp_groups ──────────────────────────────────────────────
create policy "admins_full_access_camp_groups"
  on camp_groups for all
  using (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  );

create policy "coaches_read_camp_groups"
  on camp_groups for select
  using (get_user_role() = 'coach' and camp_id = any (current_user_coach_camp_ids()));

create policy "family_read_camp_groups"
  on camp_groups for select
  using (camp_id = any (current_user_camp_ids()));

-- ── camp_coaches ─────────────────────────────────────────────
create policy "admins_full_access_camp_coaches"
  on camp_coaches for all
  using (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  );

create policy "coaches_read_own_camp_assignments"
  on camp_coaches for select
  using (coach_id = auth.uid());

-- ── campers ──────────────────────────────────────────────────
create policy "admins_full_access_campers"
  on campers for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_camp_campers"
  on campers for select
  using (get_user_role() = 'coach' and camp_id = any (current_user_coach_camp_ids()));

create policy "family_read_own_camper"
  on campers for select
  using (id = any (current_user_camper_ids()));

create policy "family_update_own_camper"
  on campers for update
  using (id = any (current_user_camper_ids()))
  with check (id = any (current_user_camper_ids()));

-- ── camp_evaluations ─────────────────────────────────────────
create policy "admins_full_access_camp_evaluations"
  on camp_evaluations for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_manage_camp_evaluations"
  on camp_evaluations for all
  using (get_user_role() = 'coach' and camp_id = any (current_user_coach_camp_ids()))
  with check (get_user_role() = 'coach' and camp_id = any (current_user_coach_camp_ids()));

-- Family sees the evaluation only once it has dropped (completed).
create policy "family_read_camper_evaluation"
  on camp_evaluations for select
  using (status = 'completed' and camper_id = any (current_user_camper_ids()));

-- ── camp_milestone_definitions ───────────────────────────────
create policy "everyone_reads_camp_milestone_catalog"
  on camp_milestone_definitions for select
  using (org_id = get_user_org());

create policy "admins_manage_camp_milestone_catalog"
  on camp_milestone_definitions for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- ── camper_milestones ────────────────────────────────────────
create policy "admins_full_access_camper_milestones"
  on camper_milestones for all
  using (
    get_user_role() = 'admin'
    and camper_id in (select id from campers where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and camper_id in (select id from campers where org_id = get_user_org())
  );

create policy "coaches_manage_camper_milestones"
  on camper_milestones for all
  using (
    get_user_role() = 'coach'
    and camper_id in (
      select id from campers where camp_id = any (current_user_coach_camp_ids())
    )
  )
  with check (
    get_user_role() = 'coach'
    and camper_id in (
      select id from campers where camp_id = any (current_user_coach_camp_ids())
    )
  );

create policy "family_read_camper_milestones"
  on camper_milestones for select
  using (camper_id = any (current_user_camper_ids()));

-- ── camp_coach_feedback ──────────────────────────────────────
create policy "admins_full_access_camp_coach_feedback"
  on camp_coach_feedback for all
  using (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  );

-- A coach can read (but not write) feedback about themselves.
create policy "coaches_read_own_feedback"
  on camp_coach_feedback for select
  using (coach_id = auth.uid());

-- A family writes and reads feedback for their own camper.
create policy "family_write_camper_feedback"
  on camp_coach_feedback for insert
  with check (camper_id = any (current_user_camper_ids()));

create policy "family_update_camper_feedback"
  on camp_coach_feedback for update
  using (camper_id = any (current_user_camper_ids()))
  with check (camper_id = any (current_user_camper_ids()));

create policy "family_read_camper_feedback"
  on camp_coach_feedback for select
  using (camper_id = any (current_user_camper_ids()));

-- ============================================================
-- Seed: starter camp badge catalog (per existing org)
-- ============================================================
insert into camp_milestone_definitions (org_id, key, name, description, icon_name, sort_order)
select o.id, v.key, v.name, v.description, v.icon_name, v.sort_order
from organizations o
cross join (values
  ('camp_welcome',    'Welcome to Camp',   'You showed up and got to work. The journey starts here.', 'sparkles',    10),
  ('first_rep',       'First Rep',         'Logged your first piece of camp work.',                    'check_circle', 20),
  ('humble_baller',   'Humble Baller',     'Played the right way. A true teammate all week.',          'shield',      30),
  ('hunger_mode',     'Hunger Mode',       'Wanted it more. Brought the energy every session.',        'flame',       40),
  ('camp_graduate',   'Camp Graduate',     'Finished camp strong. Evaluation is in the books.',        'trophy',      50)
) as v(key, name, description, icon_name, sort_order)
on conflict (org_id, key) do nothing;

-- ============================================================
-- Suggest a Focus
--
-- Parents propose. Coach decides. Single queue table per athlete.
--
-- Applied to the hosted DB via MCP — this file is the local
-- source of truth.
-- ============================================================

create type plan_focus_request_status as enum (
  'pending', 'acknowledged', 'used', 'archived'
);

create table plan_focus_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  athlete_id uuid references athletes(id) not null,
  parent_id uuid references profiles(id) not null,
  suggested_pillar mbhs_pillar not null,
  suggested_subcategory text,
  why text not null check (length(why) between 1 and 2000),
  status plan_focus_request_status not null default 'pending',
  coach_response text check (coach_response is null or length(coach_response) <= 2000),
  responded_by uuid references profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_focus_requests_athlete_status_idx
  on plan_focus_requests (athlete_id, status);

alter table plan_focus_requests enable row level security;

create policy "admins_full_access_plan_focus_requests"
  on plan_focus_requests for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_roster_plan_focus_requests"
  on plan_focus_requests for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "coaches_update_roster_plan_focus_requests"
  on plan_focus_requests for update
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  )
  with check (
    org_id = get_user_org()
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "parents_read_child_plan_focus_requests"
  on plan_focus_requests for select
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

create policy "parents_write_child_plan_focus_requests"
  on plan_focus_requests for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and parent_id = auth.uid()
    and athlete_id = any (current_user_child_athlete_ids())
  );

create trigger plan_focus_requests_set_updated_at
  before update on plan_focus_requests
  for each row execute function public.set_updated_at();

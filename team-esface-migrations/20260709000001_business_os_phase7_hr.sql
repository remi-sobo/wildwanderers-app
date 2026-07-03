-- ============================================================
-- Esface Business OS — Phase 7: People & HR
--
-- The ~28 people who run Esface, managed as a team. Builds on what
-- exists — evaluations, review sessions, camp feedback, sales numbers
-- — and turns it into a year-round HR system. The killer feature is
-- aggregation, not entry: the platform already knows the footprint.
--
-- Ships:
--   * performance_reviews — the TECOE rubric, year-round (the spec
--     "generalizes the camp coach review system"; no such rubric table
--     ever existed — camp_coach_feedback is campers rating coaches —
--     so this IS the first TECOE review store)
--   * onboarding_checklists — auto-created for every new staff member
--     by department template (trigger; existing staff backfilled)
--   * staff_documents — agreements, certs, W9s, with expiry dates
--   * COMP LOCKDOWN — closes a real Phase-1 gap: the directory-read
--     RLS policy exposed comp_type/base_rate_cents to every
--     hr.staff.view holder, but the spec says comp is exec + HR +
--     finance only. RLS is row-level, so the fix is column-level:
--     REVOKE the comp columns from authenticated entirely and route
--     comp access through SECURITY DEFINER accessors that check
--     hr.comp.view / hr.comp.manage.
--   * acknowledge_review() — staff sign their review without gaining
--     update rights on the review body
-- ============================================================

-- ============================================================
-- PERFORMANCE REVIEWS (TECOE rubric)
-- ============================================================

create table performance_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  staff_member_id uuid references staff_members(id) not null,
  reviewer_id uuid references profiles(id) not null,
  period text not null,               -- "2026-H1", "Summer 2026"
  review_type text check (review_type in ('camp', 'seasonal', 'annual')),
  scores jsonb,                       -- { preparedness: 4, energy: 5, ... }
  overall_score numeric,
  strengths text,
  growth_areas text,
  goals text,
  staff_acknowledgment boolean default false,
  acknowledged_at timestamptz,
  created_at timestamptz default now()
);

create index performance_reviews_staff_idx
  on performance_reviews (staff_member_id, created_at desc);

-- ============================================================
-- ONBOARDING
-- ============================================================

create table onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid references staff_members(id) on delete cascade not null unique,
  items jsonb not null,
  -- [{ label: "Read TECOE", done: true, done_at: ... }, ...]
  completed boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table staff_documents (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid references staff_members(id) on delete cascade not null,
  doc_type text,                      -- "agreement", "cert", "w9"
  name text not null,
  file_url text not null,
  expires_at date,                    -- background checks, certs
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index staff_documents_staff_idx on staff_documents (staff_member_id);
create index staff_documents_expiry_idx on staff_documents (expires_at)
  where expires_at is not null;

alter table performance_reviews   enable row level security;
alter table onboarding_checklists enable row level security;
alter table staff_documents       enable row level security;

-- ============================================================
-- RLS
-- ============================================================

-- Reviews: performance.view reads all; every staff member reads their
-- own (they must acknowledge it); performance.manage writes. Staff do
-- NOT get update on their own review — acknowledgment goes through the
-- definer function below, so the review body stays reviewer-owned.
create policy "performance_reviews_read"
  on performance_reviews for select
  using (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'hr.performance.view')
      or staff_member_id = my_staff_member_id()
    )
  );

create policy "performance_reviews_manage"
  on performance_reviews for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'hr.performance.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'hr.performance.manage')
  );

-- Checklists: HR manages; the staff member reads AND updates their own
-- (ticking your own onboarding items is the point).
create policy "onboarding_own"
  on onboarding_checklists for select
  using (staff_member_id = my_staff_member_id());

create policy "onboarding_own_update"
  on onboarding_checklists for update
  using (staff_member_id = my_staff_member_id())
  with check (staff_member_id = my_staff_member_id());

create policy "onboarding_hr"
  on onboarding_checklists for all
  using (has_business_permission((select auth.uid()), 'hr.staff.manage'))
  with check (has_business_permission((select auth.uid()), 'hr.staff.manage'));

-- Documents hold W9s and background checks: HR-manage only, plus the
-- subject's own read. Directory viewers get nothing.
create policy "staff_documents_own"
  on staff_documents for select
  using (staff_member_id = my_staff_member_id());

create policy "staff_documents_hr"
  on staff_documents for all
  using (has_business_permission((select auth.uid()), 'hr.staff.manage'))
  with check (has_business_permission((select auth.uid()), 'hr.staff.manage'));

-- ============================================================
-- COMP LOCKDOWN (column-level)
-- ============================================================
-- RLS can't hide columns, and a COLUMN revoke is a no-op while the
-- table-level grant stands (PostgreSQL resolves privileges as
-- table-OR-column). So: drop the table-level privileges entirely and
-- grant back ONLY the non-comp columns. Every legitimate comp
-- read/write goes through the definer accessors below, which check
-- hr.comp.* (owner short-circuits). The payroll generator (SECURITY
-- DEFINER) is unaffected. App code never selects * from staff_members.

revoke select, insert, update on staff_members from authenticated;
grant select (id, org_id, profile_id, employee_number, department, title,
              reports_to, employment_type, start_date, end_date, is_active,
              created_at)
  on staff_members to authenticated;
grant insert (org_id, profile_id, employee_number, department, title,
              reports_to, employment_type, start_date, end_date, is_active)
  on staff_members to authenticated;
grant update (employee_number, department, title, reports_to,
              employment_type, start_date, end_date, is_active)
  on staff_members to authenticated;

create or replace function public.get_staff_comp(p_staff_id uuid)
returns table (
  comp_type text,
  base_rate_cents int,
  commission_eligible boolean,
  notes text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_business_permission(auth.uid(), 'hr.comp.view') then
    raise exception 'COMP_FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select s.comp_type, s.base_rate_cents, s.commission_eligible, s.notes
  from public.staff_members s
  where s.id = p_staff_id
    and s.org_id = (select org_id from public.profiles where id = auth.uid());
end;
$$;

create or replace function public.set_staff_comp(
  p_staff_id uuid,
  p_comp_type text,
  p_base_rate_cents int,
  p_commission_eligible boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.has_business_permission(auth.uid(), 'hr.comp.manage') then
    raise exception 'COMP_FORBIDDEN' using errcode = '42501';
  end if;
  if p_comp_type is not null and p_comp_type not in
     ('hourly','salary','per_session','commission','mixed') then
    raise exception 'COMP_BAD_TYPE' using errcode = 'P0001';
  end if;
  update public.staff_members s
  set comp_type = p_comp_type,
      base_rate_cents = p_base_rate_cents,
      commission_eligible = coalesce(p_commission_eligible, false)
  where s.id = p_staff_id
    and s.org_id = (select org_id from public.profiles where id = auth.uid());
end;
$$;

/** Staff sign their own review; nothing else on the row is theirs. */
create or replace function public.acknowledge_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.performance_reviews r
  set staff_acknowledgment = true, acknowledged_at = now()
  where r.id = p_review_id
    and r.staff_member_id = public.my_staff_member_id()
    and not r.staff_acknowledgment;
  if not found then
    raise exception 'ACK_NOT_YOURS' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.get_staff_comp(uuid) from public, anon;
revoke execute on function public.set_staff_comp(uuid, text, int, boolean) from public, anon;
revoke execute on function public.acknowledge_review(uuid) from public, anon;
grant execute on function public.get_staff_comp(uuid) to authenticated, service_role;
grant execute on function public.set_staff_comp(uuid, text, int, boolean) to authenticated, service_role;
grant execute on function public.acknowledge_review(uuid) to authenticated, service_role;

-- ============================================================
-- ONBOARDING AUTO-CREATION — no double entry
-- ============================================================

create or replace function public.default_onboarding_items(p_department department)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_department = 'coaching' then jsonb_build_array(
      jsonb_build_object('label', 'Read TECOE — This is The Way', 'done', false),
      jsonb_build_object('label', 'Complete your staff profile', 'done', false),
      jsonb_build_object('label', 'Shadow 2 practices', 'done', false),
      jsonb_build_object('label', 'First evaluation reviewed by a Coach Leader', 'done', false),
      jsonb_build_object('label', 'Hold your first Review Session', 'done', false))
    when p_department = 'sales' then jsonb_build_array(
      jsonb_build_object('label', 'Read TECOE — This is The Way', 'done', false),
      jsonb_build_object('label', 'Complete your staff profile', 'done', false),
      jsonb_build_object('label', 'Walk the pipeline with the Sales Lead', 'done', false),
      jsonb_build_object('label', 'Log your first 5 lead activities', 'done', false))
    else jsonb_build_array(
      jsonb_build_object('label', 'Read TECOE — This is The Way', 'done', false),
      jsonb_build_object('label', 'Complete your staff profile', 'done', false),
      jsonb_build_object('label', 'Meet your department lead', 'done', false))
  end;
$$;

create or replace function public.create_onboarding_on_staff_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.onboarding_checklists (staff_member_id, items)
  values (new.id, public.default_onboarding_items(new.department))
  on conflict (staff_member_id) do nothing;
  return new;
end;
$$;

create trigger staff_members_create_onboarding
  after insert on staff_members
  for each row execute function public.create_onboarding_on_staff_insert();

revoke execute on function public.create_onboarding_on_staff_insert()
  from public, anon, authenticated;

-- Backfill: every existing staff member gets their checklist.
insert into onboarding_checklists (staff_member_id, items)
select s.id, public.default_onboarding_items(s.department)
from staff_members s
on conflict (staff_member_id) do nothing;

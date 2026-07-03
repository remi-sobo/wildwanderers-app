-- ============================================================
-- Team Esface — Camp attendance / daily check-in
-- Camp Module · Operations
--
-- A camp runs on a daily rhythm and a director needs to know who is
-- here each day. This adds a single attendance record per camper per
-- day, marked by a coach (or HQ) from the check-in screen.
--
-- One row per (camper, day): the check-in screen upserts, so a tap
-- flips today's status without ever creating duplicates.
-- ============================================================

create table camp_attendance (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) not null,
  camp_id    uuid references camps(id) on delete cascade not null,
  camper_id  uuid references campers(id) on delete cascade not null,
  day        date not null,
  status     text not null default 'present' check (status in ('present', 'absent', 'late')),
  marked_by  uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (camper_id, day)
);

create index camp_attendance_camp_day_idx on camp_attendance (camp_id, day);
create index camp_attendance_camper_idx   on camp_attendance (camper_id);

create trigger camp_attendance_updated_at
  before update on camp_attendance
  for each row execute function set_updated_at();

alter table camp_attendance enable row level security;

-- HQ: full access within their org.
create policy "admins_full_access_camp_attendance"
  on camp_attendance for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- Coaches: mark + read attendance for campers in the camps they staff.
create policy "coaches_manage_camp_attendance"
  on camp_attendance for all
  using (
    get_user_role() = 'coach'
    and camp_id = any (current_user_coach_camp_ids())
  )
  with check (
    get_user_role() = 'coach'
    and camp_id = any (current_user_coach_camp_ids())
  );

-- Family: read their own camper's attendance.
create policy "family_read_camper_attendance"
  on camp_attendance for select
  using (camper_id = any (current_user_camper_ids()));

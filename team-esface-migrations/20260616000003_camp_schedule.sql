-- ============================================================
-- Team Esface — Camp schedule
-- Camp Module · Phase 5
--
-- A camp week has a daily rhythm (sessions, times, location). This adds
-- a simple per-camp schedule that coaches and families can see, and HQ
-- can build. Optionally an event is scoped to a single group.
-- ============================================================

create table camp_schedule_events (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) not null,
  camp_id    uuid references camps(id) on delete cascade not null,
  group_id   uuid references camp_groups(id) on delete set null,
  title      text not null,
  location   text,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  created_at timestamptz default now()
);

create index camp_schedule_events_camp_idx
  on camp_schedule_events (camp_id, starts_at);

alter table camp_schedule_events enable row level security;

create policy "admins_manage_camp_schedule"
  on camp_schedule_events for all
  using (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  )
  with check (
    get_user_role() = 'admin'
    and camp_id in (select id from camps where org_id = get_user_org())
  );

create policy "coaches_read_camp_schedule"
  on camp_schedule_events for select
  using (get_user_role() = 'coach' and camp_id = any (current_user_coach_camp_ids()));

create policy "family_read_camp_schedule"
  on camp_schedule_events for select
  using (camp_id = any (current_user_camp_ids()));

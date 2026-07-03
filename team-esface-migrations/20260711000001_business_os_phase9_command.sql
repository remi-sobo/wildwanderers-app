-- ============================================================
-- Esface Business OS — Phase 9: The CEO Dashboard (Esface Command)
--
-- The single screen Dele opens every morning, visible only with
-- leadership.dashboard.view (Owner + Executive + Sales Lead). This
-- migration ships the data layer: goals & targets. The dashboard
-- itself is pure aggregation over tables phases 1–8 built — it adds
-- no new program data, exactly as the spec intends.
--
-- Goal metrics supported in V1 (each computable from live data):
--   revenue_mtd           — collected revenue this calendar month
--   athlete_count         — active athletes
--   camp_conversion_rate  — % of campers converted to athletes
--   open_pipeline_value   — estimated value of open leads
-- ('active_memberships' from the spec is omitted: memberships do not
-- exist in the platform yet; a goal nobody can move is a lie.)
-- ============================================================

create table business_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,                 -- "June Revenue"
  metric text not null check (metric in
    ('revenue_mtd', 'athlete_count', 'camp_conversion_rate',
     'open_pipeline_value')),
  target_value numeric not null check (target_value > 0),
  period text not null,               -- "2026-06" (or "2026" for annual)
  set_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (org_id, metric, period)
);

alter table business_goals enable row level security;

-- Dashboard viewers read goals; only leadership.goals.manage sets them.
create policy "business_goals_read"
  on business_goals for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'leadership.dashboard.view')
  );

create policy "business_goals_manage"
  on business_goals for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'leadership.goals.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'leadership.goals.manage')
  );

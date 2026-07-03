-- ============================================================
-- Coach metrics
--
-- Admins define the metrics (catalog) and record observations per
-- coach per season. Coaches see their own scorecard read-only on
-- /coach/profile. No public leaderboard — by design, to avoid the
-- wrong incentives.
--
-- Already applied to the hosted DB via MCP. This file is here so
-- local + remote agree.
-- ============================================================

create type coach_metric_kind as enum ('boolean', 'rating');

create table coach_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  key text not null,
  label text not null,
  description text,
  kind coach_metric_kind not null,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

create table coach_metric_evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  definition_id uuid references coach_metric_definitions(id) on delete cascade not null,
  season text not null,
  bool_value boolean,
  rating_value int check (rating_value is null or rating_value between 1 and 5),
  note text,
  evaluated_by uuid references profiles(id),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, definition_id, season),
  constraint at_least_one_value
    check (bool_value is not null or rating_value is not null)
);

create index coach_metric_evaluations_coach_season_idx
  on coach_metric_evaluations (coach_id, season);

alter table coach_metric_definitions enable row level security;
alter table coach_metric_evaluations enable row level security;

create policy "admins_full_access_coach_metric_definitions"
  on coach_metric_definitions for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_coach_metric_definitions"
  on coach_metric_definitions for select
  using (org_id = get_user_org() and get_user_role() = 'coach');

create policy "admins_full_access_coach_metric_evaluations"
  on coach_metric_evaluations for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_own_coach_metric_evaluations"
  on coach_metric_evaluations for select
  using (
    get_user_role() = 'coach'
    and coach_id = auth.uid()
  );

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger coach_metric_definitions_set_updated_at
  before update on coach_metric_definitions
  for each row execute function public.set_updated_at();

create trigger coach_metric_evaluations_set_updated_at
  before update on coach_metric_evaluations
  for each row execute function public.set_updated_at();

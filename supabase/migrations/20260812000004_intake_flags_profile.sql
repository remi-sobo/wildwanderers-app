-- ============================================================
-- Wild Wanderers — Client profile: intake and flags
--
-- The spine of the premium fitness experience: a guided intake Gabe
-- fills during the first conversation, standing flags surfaced every
-- time he opens the client, and the intake baseline marked inside the
-- existing Ring 6 assessment engine so day one is data point one.
--
-- Two new tables:
--   * client_intakes — one living intake per client. The goal is NOT
--     here: clients.goal stays the single source. Story and lifestyle
--     are long-form text, written once, read when needed, editable
--     after the fact (versioned by updated_at).
--   * client_flags — short, standing training accommodations. Two
--     prompted fields (what to know, what we adjust) keep the language
--     as accommodations, never diagnoses. Resolved flags keep their
--     history and leave the band.
--
-- Spec note: the build spec names an assessment_sessions table with a
-- kind 'intake_baseline'. The live Ring 6 engine records results
-- directly (assessments + assessment_results, no session grouping), so
-- the baseline marker lands as a context column on assessment_results
-- instead, same intent, no refactor of a verified engine.
--
-- Security (the crown jewels):
--   * Intake and flags are health-adjacent. Strictest RLS from this
--     first migration: staff manage within their org, the client reads
--     their own record, nobody else. Their body, their data.
--   * The base health_tracking consent covers this data; the consent
--     copy and version bump to v3 in the app (like the Ring 6 v2 bump)
--     to name intake notes and training flags plainly.
--   * Writes are audited to the sealed audit_events ledger from the
--     server actions, like the other sensitive tables.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type flag_status as enum ('active', 'resolved');
create type flag_origin as enum ('intake', 'manual');
create type assessment_context as enum ('standard', 'intake_baseline');

-- ============================================================
-- CLIENT INTAKES — one living intake per client, typed by the coach
-- during the first conversation. Long-form narrative, not a form the
-- client fills alone. No recording or transcription anywhere in this
-- flow: typed notes only, by decision.
-- ============================================================
create table client_intakes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null unique,
  story_md text,                       -- health and movement history, narrative
  lifestyle_md text,                   -- work shape, sleep, activity, schedule
  conducted_at timestamptz not null default now(),
  conducted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_intakes_org on client_intakes (org_id);

-- Keep updated_at honest on every edit (the intake is versioned by it).
create or replace function public.client_intakes_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.client_intakes_touch_updated_at() from public, anon, authenticated;

create trigger trg_client_intakes_touch
  before update on client_intakes
  for each row execute function public.client_intakes_touch_updated_at();

-- ============================================================
-- CLIENT FLAGS — one line each, standing, surfaced every time the
-- coach opens the client. Training accommodations, never diagnoses:
-- what to know, and what we adjust.
-- ============================================================
create table client_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  know_text text not null,             -- "Left knee surgery 2019"
  adjust_text text,                    -- "No loaded jumping"
  status flag_status not null default 'active',
  created_from flag_origin not null default 'manual',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_client_flags_client on client_flags (client_id, status);
create index idx_client_flags_org on client_flags (org_id);

-- ── assessment_results: mark the intake baseline ───────────
-- Day one becomes data point one; the first assessment session is the
-- intake baseline, recorded through the same battery as every later one.
alter table assessment_results
  add column context assessment_context not null default 'standard';
create index idx_results_context on assessment_results (client_id, context)
  where context = 'intake_baseline';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table client_intakes enable row level security;
alter table client_flags   enable row level security;

-- ── client_intakes: staff manage in org; the client reads their own ──
create policy "staff_manage_client_intakes"
  on client_intakes for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_intake"
  on client_intakes for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

-- ── client_flags: staff manage in org; the client reads their own ──
-- The client sees their flags in full, "what we adjust" included: they
-- told the coach about the knee, and seeing the adjustment builds trust.
create policy "staff_manage_client_flags"
  on client_flags for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_own_flags"
  on client_flags for select
  using (org_id = get_user_org() and get_user_role() = 'client'
         and client_id = any (current_user_client_id()));

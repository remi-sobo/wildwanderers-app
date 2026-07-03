-- ============================================================
-- Wild Wanderers — Ring 4: the business switch
--
-- Gabe's back office, forked from the Team Esface business OS and
-- simplified for a solo wellness coach: no permission-set machinery (Gabe
-- is the only owner), no payroll or commissions yet (schema room stays for
-- a second coach later). Money is involved, so two guardrails lead:
--   * No fabricated financials. These tables only ever hold what Gabe
--     enters or Stripe reports. Business opens empty. We seed only the
--     offerings catalog, with placeholder prices Gabe sets.
--   * Owner-only, from this first migration. Every table is org-scoped and
--     gated to the 'owner' role by RLS. No coach and no client reads it.
--
-- Uses the Ring 0 helpers: get_user_org(), get_user_role().
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type customer_lifecycle as enum ('lead', 'active', 'paused', 'churned');
create type lead_source as enum ('website', 'referral', 'walk_in', 'social', 'other');
create type lead_interest as enum ('one_on_one', 'small_group', 'wellness', 'boys_program', 'other');
create type lead_stage as enum ('new', 'contacted', 'engaged', 'trial', 'proposal', 'won', 'lost', 'nurture');
create type lead_activity_kind as enum ('call', 'text', 'email', 'in_person', 'note', 'stage_change');
create type offering_kind as enum ('one_on_one', 'small_group', 'wellness', 'boys_program', 'other');
create type offering_cadence as enum ('one_time', 'weekly', 'monthly');
create type revenue_status as enum ('pending', 'collected', 'refunded');
create type revenue_source as enum ('manual', 'stripe');
create type expense_category as enum ('facilities', 'equipment', 'software', 'marketing', 'travel', 'insurance', 'food', 'other');
create type task_priority as enum ('urgent', 'high', 'medium', 'low');
create type task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type task_category as enum ('sales', 'coaching', 'program', 'finance', 'admin', 'other');
create type goal_metric as enum ('revenue_mtd', 'active_clients', 'open_pipeline_value');

-- ── customers (the paying person or family) ────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  email text,
  phone text,
  lifecycle_stage customer_lifecycle not null default 'lead',
  first_touch_source lead_source,
  lifetime_value_cents int not null default 0,
  active_enrollments int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_org_email_uniq on customers (org_id, lower(email)) where email is not null;
create index customers_org_stage_idx on customers (org_id, lifecycle_stage);

-- ── leads (the pipeline) ───────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  email text,
  phone text,
  source lead_source not null default 'other',
  interest lead_interest,
  estimated_value_cents int,
  stage lead_stage not null default 'new',
  next_action text,
  next_action_date date,
  lost_reason text,
  closed_at timestamptz,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_org_stage_idx on leads (org_id, stage);
create index leads_next_action_idx on leads (org_id, next_action_date)
  where stage not in ('won', 'lost');

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  lead_id uuid references leads(id) on delete cascade not null,
  kind lead_activity_kind not null default 'note',
  content text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on lead_activities (lead_id, created_at desc);

-- ── offerings (the catalog) ────────────────────────────────
create table offerings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  kind offering_kind not null default 'one_on_one',
  price_cents int,                     -- null until Gabe sets it
  cadence offering_cadence not null default 'one_time',
  is_active boolean not null default true,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index offerings_org_active_idx on offerings (org_id) where is_active;

-- ── revenue_events ─────────────────────────────────────────
create table revenue_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  customer_id uuid references customers(id) on delete set null,
  offering_id uuid references offerings(id) on delete set null,
  category offering_kind not null default 'other',
  description text,
  amount_cents int not null,
  status revenue_status not null default 'collected',
  source revenue_source not null default 'manual',
  stripe_payment_intent_id text,      -- reserved for the Stripe ingest (4b)
  occurred_at timestamptz not null default now(),
  entered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index revenue_org_time_idx on revenue_events (org_id, occurred_at desc);
create index revenue_customer_idx on revenue_events (customer_id);

-- ── expenses ───────────────────────────────────────────────
create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  category expense_category not null default 'other',
  vendor text,
  description text,
  amount_cents int not null,
  expense_date date not null default (now() at time zone 'utc')::date,
  receipt_url text,
  recurring boolean not null default false,
  entered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index expenses_org_date_idx on expenses (org_id, expense_date desc);

-- ── business_tasks ─────────────────────────────────────────
create table business_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  title text not null,
  description text,
  category task_category not null default 'other',
  priority task_priority not null default 'medium',
  due_date date,
  pin_today boolean not null default false,
  status task_status not null default 'open',
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index business_tasks_org_status_idx on business_tasks (org_id, status, pin_today);
create index business_tasks_due_idx on business_tasks (org_id, due_date)
  where status in ('open', 'in_progress');

-- ── business_goals ─────────────────────────────────────────
create table business_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  metric goal_metric not null,
  target_value numeric not null check (target_value > 0),
  period text not null,               -- '2026-07' or '2026'
  set_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, metric, period)
);

-- ============================================================
-- ROW LEVEL SECURITY — owner-only, org-scoped, every table
-- ============================================================
alter table customers       enable row level security;
alter table leads           enable row level security;
alter table lead_activities enable row level security;
alter table offerings       enable row level security;
alter table revenue_events  enable row level security;
alter table expenses        enable row level security;
alter table business_tasks  enable row level security;
alter table business_goals  enable row level security;

-- One owner-only policy per table: Gabe manages his own org's business data,
-- nobody else reads or writes it.
create policy "owner_manages_customers" on customers for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_leads" on leads for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_lead_activities" on lead_activities for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_offerings" on offerings for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_revenue" on revenue_events for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_expenses" on expenses for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_tasks" on business_tasks for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

create policy "owner_manages_goals" on business_goals for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ============================================================
-- SEED — the offerings catalog only, with placeholder prices Gabe sets.
-- This is configuration, not a fabricated result; prices are null and
-- clearly flagged in the UI until Gabe fills them in.
-- ============================================================
insert into offerings (org_id, name, kind, cadence, description, sort_order)
select o.id, x.name, x.kind::offering_kind, x.cadence::offering_cadence, x.descr, x.ord
from public.organizations o,
  (values
    ('1:1 Coaching', 'one_on_one', 'monthly', 'One on one training and wellness coaching.', 0),
    ('Small Group', 'small_group', 'monthly', 'Small group training sessions.', 1),
    ('Wellness Coaching', 'wellness', 'monthly', 'Habits, movement, and check-in coaching.', 2),
    ('Boys Program', 'boys_program', 'monthly', 'The boys program tuition.', 3)
  ) as x(name, kind, cadence, descr, ord)
where o.slug = 'wild-wanderers-fitness'
on conflict (org_id, name) do nothing;

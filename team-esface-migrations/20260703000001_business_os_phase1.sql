-- ============================================================
-- Esface Business OS — Phase 1: Permissions & Staff Foundation
--
-- Builds the business layer's access-control substrate. The program
-- layer keeps its four roles (admin/coach/parent/athlete); the business
-- layer adds STAFF POSITIONS and DEPARTMENT PERMISSIONS on top. One
-- person can hold both — a coach who also sells has a coach program
-- role AND a sales staff position.
--
-- The load-bearing rule (BUSINESS_OS_SPEC, "Enforcement"):
--   Every business permission is enforced BOTH in API routes
--   (requirePermission) AND at the database level (RLS via
--   has_business_permission). Never one without the other.
--
-- This migration ships:
--   * staff_members, permission_sets, staff_permissions
--   * organizations.owner_profile_id (lockout-proof owner tier)
--   * is_org_owner() + has_business_permission() — the ONE predicate
--     shared by RLS policies and the requirePermission() middleware
--   * the 8 built-in permission sets, seeded per organization
--   * payroll_periods + payroll_lines as an RLS-GATED SHELL — schema
--     and finance.payroll.* policies only, no Phase-6 logic. They exist
--     now so the Phase-1 acceptance test can prove, against real RLS,
--     that a Sales Rep cannot read payroll. All payroll computation,
--     auto-generation, review/approve and CSV export remain Phase 6.
--   * Row Level Security enabled on every table in the same file.
-- ============================================================

-- ============================================================
-- OWNER TIER
-- ============================================================
-- The org owner (Dele) sits above the permission system: they get
-- every business permission unconditionally, and the Owner set can
-- never be deleted or downgraded from the UI. Storing the owner on the
-- organization (env-independent, single row) mirrors the founder-email
-- lockout-proofing already used at the app layer: no bad permission
-- write can lock the owner out of their own business.

alter table organizations
  add column if not exists owner_profile_id uuid references profiles(id);

-- ============================================================
-- STAFF & POSITIONS
-- ============================================================

create type department as enum
  ('executive', 'sales', 'coaching', 'program_ops',
   'finance', 'hr', 'marketing');

create type employment_type as enum
  ('full_time', 'part_time', 'contractor', 'seasonal');

create table staff_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  profile_id uuid references profiles(id) not null unique,
  employee_number text,
  department department not null,
  title text not null,                   -- "Sales Lead", "Head Coach", ...
  reports_to uuid references staff_members(id),
  employment_type employment_type default 'part_time',
  start_date date,
  end_date date,
  is_active boolean default true,
  -- compensation (visible only to exec + hr + finance via RLS on this
  -- column's consumers; the row itself is directory data)
  comp_type text check (comp_type in
    ('hourly','salary','per_session','commission','mixed')),
  base_rate_cents int,
  commission_eligible boolean default false,
  notes text,
  created_at timestamptz default now()
);

create index staff_members_org_idx on staff_members(org_id);
create index staff_members_profile_idx on staff_members(profile_id);
create index staff_members_reports_to_idx on staff_members(reports_to);

-- ============================================================
-- PERMISSIONS
-- ============================================================
-- Granular business permissions, grouped by area. A staff member gets
-- one or more permission sets; the union of their sets' `permissions`
-- arrays is their effective grant.

create table permission_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,                    -- "Sales Rep", "Finance", "Owner"
  description text,
  permissions text[] not null,
  is_system boolean default false,       -- built-in sets can't be deleted
  created_at timestamptz default now(),
  unique (org_id, name)
);

create table staff_permissions (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid references staff_members(id) on delete cascade not null,
  permission_set_id uuid references permission_sets(id) on delete cascade not null,
  granted_by uuid references profiles(id),
  granted_at timestamptz default now(),
  unique (staff_member_id, permission_set_id)
);

create index staff_permissions_staff_idx on staff_permissions(staff_member_id);
create index staff_permissions_set_idx on staff_permissions(permission_set_id);

-- ============================================================
-- PAYROLL SHELL (schema + RLS only — no Phase-6 logic)
-- ============================================================
-- These two tables exist in Phase 1 for ONE reason: to make the
-- Phase-1 acceptance test provable against real Row Level Security —
-- "a Sales Rep cannot read payroll." Columns match the Phase-6 spec so
-- Phase 6 adds behaviour, not schema churn. No triggers, no computation,
-- no UI ship in Phase 1.

create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  period text not null,                  -- "2026-06"
  start_date date not null,
  end_date date not null,
  status text default 'open' check (status in
    ('open', 'review', 'approved', 'paid')),
  total_cents int,
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table payroll_lines (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id) not null,
  staff_member_id uuid references staff_members(id) not null,
  base_amount_cents int default 0,
  sessions_count int default 0,
  sessions_amount_cents int default 0,
  commissions_amount_cents int default 0,
  bonus_amount_cents int default 0,
  adjustments_cents int default 0,
  adjustment_note text,
  total_cents int not null,
  status text default 'draft',
  created_at timestamptz default now()
);

create index payroll_periods_org_idx on payroll_periods(org_id);
create index payroll_lines_period_idx on payroll_lines(period_id);
create index payroll_lines_staff_idx on payroll_lines(staff_member_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (same file as table creation)
-- ============================================================

alter table staff_members     enable row level security;
alter table permission_sets   enable row level security;
alter table staff_permissions enable row level security;
alter table payroll_periods   enable row level security;
alter table payroll_lines     enable row level security;

-- ============================================================
-- THE SHARED PREDICATE
-- ============================================================
-- has_business_permission() is the single source of truth for business
-- access. The requirePermission() middleware calls it over RPC; every
-- business RLS policy calls it inline. API and database enforce the
-- exact same boolean — they cannot drift.
--
-- SECURITY DEFINER so it can read the staff/permission tables regardless
-- of the caller's own RLS (no recursion: the definer bypasses RLS on the
-- tables it reads). search_path is pinned per the config-integrity gate.

create or replace function public.is_org_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.organizations o
    where o.owner_profile_id = p_user_id
  );
$$;

create or replace function public.has_business_permission(
  p_user_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    coalesce(public.is_org_owner(p_user_id), false)
    or exists (
      select 1
      from public.staff_members sm
      join public.staff_permissions sp on sp.staff_member_id = sm.id
      join public.permission_sets ps on ps.id = sp.permission_set_id
      where sm.profile_id = p_user_id
        and sm.is_active
        and p_permission = any (ps.permissions)
    );
$$;

-- Returns the caller's full effective permission list. Used by the
-- server to render the Business sidebar and by getCurrentUserPermissions.
create or replace function public.my_business_permissions()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when public.is_org_owner(auth.uid())
      then (
        select coalesce(array_agg(distinct p), '{}')
        from public.permission_sets ps2, unnest(ps2.permissions) p
        where ps2.name = 'Owner'
          and ps2.org_id = (select org_id from public.profiles where id = auth.uid())
      )
    else coalesce((
      select array_agg(distinct p)
      from public.staff_members sm
      join public.staff_permissions sp on sp.staff_member_id = sm.id
      join public.permission_sets ps on ps.id = sp.permission_set_id
      cross join unnest(ps.permissions) p
      where sm.profile_id = auth.uid()
        and sm.is_active
    ), '{}')
  end;
$$;

revoke execute on function public.is_org_owner(uuid)                 from public, anon;
revoke execute on function public.has_business_permission(uuid, text) from public, anon;
revoke execute on function public.my_business_permissions()          from public, anon;
grant  execute on function public.is_org_owner(uuid)                 to authenticated, service_role;
grant  execute on function public.has_business_permission(uuid, text) to authenticated, service_role;
grant  execute on function public.my_business_permissions()          to authenticated, service_role;

-- ============================================================
-- RLS POLICIES
-- ============================================================
-- Every policy is org-scoped via get_user_org() (from the initial
-- schema) and gated by has_business_permission(). auth.uid() is wrapped
-- in a scalar subselect so it evaluates once per query (the initplan
-- optimisation the platform standardised on).

-- ---- staff_members --------------------------------------------------
-- Managers (hr.staff.manage or business.permissions.manage) get full
-- access; hr.staff.view is read-only directory access; every staff
-- member can always read their own row (needed to render their own
-- sidebar and profile).
create policy "staff_members_manage"
  on staff_members for all
  using (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'hr.staff.manage')
      or has_business_permission((select auth.uid()), 'business.permissions.manage')
    )
  )
  with check (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'hr.staff.manage')
      or has_business_permission((select auth.uid()), 'business.permissions.manage')
    )
  );

create policy "staff_members_directory_read"
  on staff_members for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'hr.staff.view')
  );

create policy "staff_members_read_own"
  on staff_members for select
  using (profile_id = (select auth.uid()));

-- ---- permission_sets ------------------------------------------------
-- Definitions are not secret (they describe roles, not data). Any
-- authenticated member of the org may read them so the app can label a
-- staff member's sets. Only business.permissions.manage may write.
create policy "permission_sets_read"
  on permission_sets for select
  using (org_id = get_user_org());

create policy "permission_sets_manage"
  on permission_sets for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'business.permissions.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'business.permissions.manage')
  );

-- ---- staff_permissions ----------------------------------------------
-- A staff member may read their OWN grants (to compute their sidebar).
-- Only business.permissions.manage may read all or grant/revoke.
create policy "staff_permissions_read_own"
  on staff_permissions for select
  using (
    staff_member_id in (
      select id from staff_members where profile_id = (select auth.uid())
    )
  );

create policy "staff_permissions_manage"
  on staff_permissions for all
  using (
    has_business_permission((select auth.uid()), 'business.permissions.manage')
  )
  with check (
    has_business_permission((select auth.uid()), 'business.permissions.manage')
  );

-- ---- payroll_periods ------------------------------------------------
create policy "payroll_periods_view"
  on payroll_periods for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.payroll.view')
  );

create policy "payroll_periods_manage"
  on payroll_periods for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.payroll.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.payroll.manage')
  );

-- ---- payroll_lines --------------------------------------------------
-- Gated through the parent period's org. This is the exact wall the
-- Phase-1 acceptance test drives: a Sales Rep has no finance.payroll.*
-- permission, so this SELECT returns zero rows for them.
create policy "payroll_lines_view"
  on payroll_lines for select
  using (
    has_business_permission((select auth.uid()), 'finance.payroll.view')
    and exists (
      select 1 from payroll_periods pp
      where pp.id = payroll_lines.period_id
        and pp.org_id = get_user_org()
    )
  );

create policy "payroll_lines_manage"
  on payroll_lines for all
  using (
    has_business_permission((select auth.uid()), 'finance.payroll.manage')
    and exists (
      select 1 from payroll_periods pp
      where pp.id = payroll_lines.period_id
        and pp.org_id = get_user_org()
    )
  )
  with check (
    has_business_permission((select auth.uid()), 'finance.payroll.manage')
    and exists (
      select 1 from payroll_periods pp
      where pp.id = payroll_lines.period_id
        and pp.org_id = get_user_org()
    )
  );

-- ============================================================
-- SEED — the 8 built-in permission sets, per organization
-- ============================================================
-- Defined as a re-runnable function so both this migration (for existing
-- orgs) and future org-creation (Phase 2+) seed the same catalog.
-- is_system = true → cannot be deleted from the UI. Idempotent: on
-- conflict the permission list is refreshed so the catalog stays the
-- source of truth. Owner is granted every permission explicitly AND
-- short-circuited by is_org_owner(); Executive is everything except the
-- keys to the permission system itself.

create or replace function public.seed_business_permission_sets(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  all_perms text[] := array[
    'sales.pipeline.view_own','sales.pipeline.view_all','sales.leads.assign',
    'sales.commissions.view_own','sales.commissions.view_all','sales.commissions.configure',
    'crm.customers.view','crm.customers.edit','crm.customers.export',
    'finance.revenue.view','finance.expenses.view','finance.expenses.manage',
    'finance.payroll.view','finance.payroll.manage','finance.pnl.view',
    'hr.staff.view','hr.staff.manage','hr.comp.view','hr.comp.manage',
    'hr.performance.view','hr.performance.manage',
    'ops.tasks.view_own','ops.tasks.view_all','ops.tasks.assign',
    'leadership.dashboard.view','leadership.goals.manage',
    'business.permissions.manage','business.settings.manage'
  ];
begin
    -- Owner — everything
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Owner', 'Full access to everything. Dele only.', all_perms, true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Executive — everything except managing permissions
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Executive', 'Senior HQ. Everything except permission management.',
      (select array_agg(p) from unnest(all_perms) p where p <> 'business.permissions.manage'),
      true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Sales Lead
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Sales Lead', 'Head of sales.',
      array[
        'sales.pipeline.view_own','sales.pipeline.view_all','sales.leads.assign',
        'sales.commissions.view_own','sales.commissions.view_all','sales.commissions.configure',
        'crm.customers.view','crm.customers.edit','crm.customers.export',
        'ops.tasks.view_own','ops.tasks.view_all','ops.tasks.assign',
        'leadership.dashboard.view'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Sales Rep — coach-sellers
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Sales Rep', 'Coach-sellers. Own pipeline and customers only.',
      array[
        'sales.pipeline.view_own','sales.commissions.view_own',
        'crm.customers.view','crm.customers.edit','ops.tasks.view_own'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Finance
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Finance', 'Finance staff.',
      array[
        'finance.revenue.view','finance.expenses.view','finance.expenses.manage',
        'finance.payroll.view','finance.payroll.manage','finance.pnl.view',
        'crm.customers.view','hr.comp.view'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- HR
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'HR', 'HR staff.',
      array[
        'hr.staff.view','hr.staff.manage','hr.comp.view','hr.comp.manage',
        'hr.performance.view','hr.performance.manage',
        'ops.tasks.view_own','ops.tasks.view_all','ops.tasks.assign'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Coach Leader
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Coach Leader', 'Coaching directors.',
      array[
        'hr.performance.view','hr.staff.view',
        'ops.tasks.view_all','ops.tasks.assign'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;

    -- Program Lead
    insert into permission_sets (org_id, name, description, permissions, is_system)
    values (p_org_id, 'Program Lead', 'Program managers.',
      array[
        'ops.tasks.view_own','ops.tasks.view_all','ops.tasks.assign',
        'crm.customers.view'
      ], true)
    on conflict (org_id, name) do update
      set permissions = excluded.permissions, description = excluded.description;
end;
$$;

-- Service-role only: seeding sets is an org-provisioning act, and
-- authenticated must be revoked explicitly — Supabase default
-- privileges grant function execute to authenticated at create time.
revoke execute on function public.seed_business_permission_sets(uuid)
  from public, anon, authenticated;
grant  execute on function public.seed_business_permission_sets(uuid) to service_role;

-- Seed every organization that exists today.
do $$
declare
  org record;
begin
  for org in select id from organizations loop
    perform public.seed_business_permission_sets(org.id);
  end loop;
end $$;

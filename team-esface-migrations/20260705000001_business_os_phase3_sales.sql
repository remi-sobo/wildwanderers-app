-- ============================================================
-- Esface Business OS — Phase 3: Sales & Pipeline
--
-- Dele's sales team are coaches who also sell. This is a pipeline
-- built for that motion: leads flow IN automatically from program
-- activity (camp ends unconverted, tryout eval without enrollment),
-- reps work them from their phone, and a closed-won deal computes its
-- own commission. Nothing is double-entered.
--
-- Ships:
--   * lead_stage + interest_type enums (lead_source shipped in Phase 2)
--   * leads, lead_activities, commission_rules, commissions
--   * auto-lead triggers: camp completion → one lead per unconverted
--     camper; tryout evaluation completed for an unrostered athlete →
--     one lead. Both idempotent via dedupe_key.
--   * closed_won trigger: matches the active commission rule for the
--     lead's interest and writes a pending commission for the rep
--   * RLS: view_own vs view_all on leads and commissions; activities
--     inherit lead visibility; finance reads commissions (payroll feed)
--
-- V1 boundaries honored: flat/percent rules only, no tiering; no
-- native email/SMS — reps one-tap to their phone apps and log it.
-- ============================================================

create type lead_stage as enum
  ('new', 'contacted', 'engaged', 'trial_booked',
   'proposal_sent', 'closed_won', 'closed_lost', 'nurture');

create type interest_type as enum
  ('club_season', 'camp', 'training_1on1', 'training_group',
   'clinic', 'program', 'multiple');

-- ============================================================
-- LEADS & ACTIVITIES
-- ============================================================

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  -- who
  parent_name text not null,
  parent_email text,
  parent_phone text,
  athlete_name text,
  athlete_grade int,
  -- link to existing records when known
  customer_id uuid references customers(id),
  camper_id uuid references campers(id),
  athlete_id uuid references athletes(id),
  -- what
  source lead_source not null,
  interest interest_type,
  interest_detail text,               -- "wants 1on1 finishing work"
  estimated_value_cents int,
  -- pipeline
  stage lead_stage default 'new',
  assigned_to uuid references staff_members(id),
  next_action text,                   -- "call Thursday after camp"
  next_action_date date,
  lost_reason text,
  -- outcome
  closed_at timestamptz,
  won_booking_id uuid,                -- future FK: bookings ship later
  won_amount_cents int,
  -- idempotency for auto-generated leads ('camp_end:<camper>', ...)
  dedupe_key text unique,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index leads_org_stage_idx on leads (org_id, stage);
create index leads_assigned_idx on leads (assigned_to);
create index leads_customer_idx on leads (customer_id);
create index leads_next_action_idx on leads (org_id, next_action_date)
  where stage not in ('closed_won', 'closed_lost');

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade not null,
  staff_member_id uuid references staff_members(id) not null,
  activity_type text not null check (activity_type in
    ('call', 'text', 'email', 'in_person', 'note',
     'stage_change', 'trial_session', 'proposal')),
  content text,
  outcome text,
  created_at timestamptz default now()
);

create index lead_activities_lead_idx on lead_activities (lead_id, created_at desc);

-- ============================================================
-- COMMISSIONS
-- ============================================================

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,                 -- "Club Season Close"
  applies_to interest_type,           -- null = any interest
  commission_type text check (commission_type in ('flat', 'percent')),
  flat_amount_cents int,
  percent numeric,                    -- 5.0 = 5%
  is_active boolean default true,
  created_at timestamptz default now()
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  staff_member_id uuid references staff_members(id) not null,
  lead_id uuid references leads(id),
  rule_id uuid references commission_rules(id),
  sale_amount_cents int not null,
  commission_amount_cents int not null,
  status text default 'pending' check (status in
    ('pending', 'approved', 'paid')),
  period text,                        -- "2026-06" for payroll grouping
  approved_by uuid references profiles(id),
  paid_at timestamptz,
  created_at timestamptz default now()
);

create index commissions_staff_idx on commissions (staff_member_id, status);
create index commissions_org_period_idx on commissions (org_id, period);

alter table leads            enable row level security;
alter table lead_activities  enable row level security;
alter table commission_rules enable row level security;
alter table commissions      enable row level security;

-- ============================================================
-- RLS
-- ============================================================
-- "Own" = leads assigned to the caller's staff row. view_all sees the
-- whole pipeline. Unassigned leads are visible only to view_all — a rep
-- can't browse the pool, the sales lead assigns from it.

-- Helper: the caller's staff_member id (null when not staff).
create or replace function public.my_staff_member_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select id from public.staff_members
  where profile_id = auth.uid() and is_active;
$$;

revoke execute on function public.my_staff_member_id() from public, anon;
grant  execute on function public.my_staff_member_id() to authenticated, service_role;

create policy "leads_view_all"
  on leads for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
  );

create policy "leads_view_own"
  on leads for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_own')
    and assigned_to = my_staff_member_id()
  );

-- Reps create manual leads (outreach, referrals) assigned to themselves
-- or unassigned; full-pipeline holders create anything in-org.
create policy "leads_insert"
  on leads for insert
  with check (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
      or (
        has_business_permission((select auth.uid()), 'sales.pipeline.view_own')
        and (assigned_to is null or assigned_to = my_staff_member_id())
      )
    )
  );

-- Reps work their own leads; view_all works any. Reassignment is
-- guarded at the action layer by sales.leads.assign (a rep updating
-- their own lead cannot hand it to someone else: with check pins
-- assigned_to unless the caller holds view_all).
create policy "leads_update_own"
  on leads for update
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_own')
    and assigned_to = my_staff_member_id()
  )
  with check (
    org_id = get_user_org()
    and assigned_to = my_staff_member_id()
  );

-- WITH CHECK must repeat the permission: Postgres accepts a new row if
-- ANY update policy's check passes, so an org-only check here would let
-- a rep reassign their own lead (their new row would sail through this
-- policy's check even though its USING never applied to them).
create policy "leads_update_all"
  on leads for update
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
  );

create policy "leads_delete_all"
  on leads for delete
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
  );

-- Activities inherit lead visibility: the subquery runs under the
-- caller's own RLS on leads, so you can log/read activity exactly on
-- the leads you can see.
create policy "lead_activities_select"
  on lead_activities for select
  using (lead_id in (select id from leads));

create policy "lead_activities_insert"
  on lead_activities for insert
  with check (
    lead_id in (select id from leads)
    and staff_member_id = my_staff_member_id()
  );

-- Rules: visible to anyone in the sales motion (reps see how their
-- commission is computed); writable only with configure.
create policy "commission_rules_select"
  on commission_rules for select
  using (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'sales.pipeline.view_own')
      or has_business_permission((select auth.uid()), 'sales.commissions.view_own')
      or has_business_permission((select auth.uid()), 'sales.commissions.view_all')
      or has_business_permission((select auth.uid()), 'sales.commissions.configure')
      or has_business_permission((select auth.uid()), 'finance.payroll.view')
    )
  );

create policy "commission_rules_manage"
  on commission_rules for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.commissions.configure')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.commissions.configure')
  );

-- Commissions: reps see their own; view_all sees everyone's; finance
-- reads them too (they feed payroll in Phase 6). Approval (update) is
-- finance.payroll.manage — Finance and the owner hold it.
create policy "commissions_view_own"
  on commissions for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.commissions.view_own')
    and staff_member_id = my_staff_member_id()
  );

create policy "commissions_view_all"
  on commissions for select
  using (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'sales.commissions.view_all')
      or has_business_permission((select auth.uid()), 'finance.payroll.view')
    )
  );

create policy "commissions_approve"
  on commissions for update
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.payroll.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.payroll.manage')
  );

-- ============================================================
-- AUTO-LEAD GENERATION — the pipeline feeds itself
-- ============================================================
-- SECURITY DEFINER: these fire from program-layer writes whose authors
-- hold no business permissions. Idempotent via dedupe_key.

/**
 * Camp completes → one lead per camper who wasn't converted to an
 * athlete. Interest: club_season (the camp→club motion). Linked to the
 * camper and their family customer so the rep sells with context.
 */
create or replace function public.generate_leads_on_camp_end()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  insert into public.leads
    (org_id, parent_name, parent_email, athlete_name, athlete_grade,
     customer_id, camper_id, source, interest, interest_detail,
     stage, dedupe_key)
  select
    cp.org_id,
    coalesce(nullif(trim(cp.last_name), ''), 'Family') || ' Family',
    cp.parent_email,
    cp.first_name || ' ' || cp.last_name,
    cp.grade,
    cp.customer_id,
    cp.id,
    'camp',
    'club_season',
    'Camp ended (' || new.name || '), not converted to club',
    'new',
    'camp_end:' || cp.id
  from public.campers cp
  where cp.camp_id = new.id
    and not cp.converted_to_athlete
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger camps_generate_leads
  after update on camps
  for each row execute function public.generate_leads_on_camp_end();

/**
 * Tryout evaluation completed for an athlete with no current team →
 * a lead. The family showed up and got evaluated; someone should call.
 */
create or replace function public.generate_lead_on_tryout_eval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_athlete record;
begin
  if new.type <> 'tryout' or new.status <> 'completed'
     or old.status = 'completed' then
    return new;
  end if;

  select a.*, c.email as customer_email,
         coalesce(c.family_name, a.last_name) as fam
  into v_athlete
  from public.athletes a
  left join public.customers c on c.id = a.customer_id
  where a.id = new.athlete_id;

  if v_athlete.id is null or v_athlete.current_team_id is not null then
    return new;
  end if;

  insert into public.leads
    (org_id, parent_name, parent_email, athlete_name, athlete_grade,
     customer_id, athlete_id, source, interest, interest_detail,
     stage, dedupe_key)
  values
    (new.org_id,
     v_athlete.fam || ' Family',
     v_athlete.customer_email,
     v_athlete.first_name || ' ' || v_athlete.last_name,
     v_athlete.grade,
     v_athlete.customer_id,
     v_athlete.id,
     'tryout_eval',
     'club_season',
     'Tryout evaluation completed, not enrolled',
     'new',
     'tryout:' || new.id)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger evaluations_generate_tryout_lead
  after update on evaluations
  for each row execute function public.generate_lead_on_tryout_eval();

-- ============================================================
-- CLOSED WON → COMMISSION
-- ============================================================

/**
 * Lead moves to closed_won → stamp closed_at, and if the rep is
 * commission-eligible, match the most specific active rule (interest
 * match beats catch-all) and write a pending commission grouped into
 * the current payroll period.
 */
create or replace function public.create_commission_on_closed_won()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rule record;
  v_amount int;
begin
  if new.stage <> 'closed_won' or old.stage = 'closed_won' then
    return new;
  end if;

  update public.leads set closed_at = coalesce(new.closed_at, now())
  where id = new.id and closed_at is null;

  if new.assigned_to is null
     or coalesce(new.won_amount_cents, 0) <= 0 then
    return new;
  end if;

  select * into v_rule
  from public.commission_rules r
  where r.org_id = new.org_id
    and r.is_active
    and (r.applies_to = new.interest or r.applies_to is null)
  order by (r.applies_to is not null) desc, r.created_at
  limit 1;

  if v_rule.id is null then return new; end if;

  v_amount := case v_rule.commission_type
    when 'flat' then coalesce(v_rule.flat_amount_cents, 0)
    when 'percent' then
      floor(coalesce(v_rule.percent, 0) * new.won_amount_cents / 100.0)::int
    else 0
  end;
  if v_amount <= 0 then return new; end if;

  insert into public.commissions
    (org_id, staff_member_id, lead_id, rule_id,
     sale_amount_cents, commission_amount_cents, status, period)
  values
    (new.org_id, new.assigned_to, new.id, v_rule.id,
     new.won_amount_cents, v_amount, 'pending', to_char(now(), 'YYYY-MM'));

  return new;
end;
$$;

create trigger leads_commission_on_won
  after update on leads
  for each row execute function public.create_commission_on_closed_won();

revoke execute on function public.generate_leads_on_camp_end()
  from public, anon, authenticated;
revoke execute on function public.generate_lead_on_tryout_eval()
  from public, anon, authenticated;
revoke execute on function public.create_commission_on_closed_won()
  from public, anon, authenticated;

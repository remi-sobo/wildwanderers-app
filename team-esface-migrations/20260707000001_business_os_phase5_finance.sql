-- ============================================================
-- Esface Business OS — Phase 5: Finance
--
-- One place where all money is visible. Revenue events are generated
-- from program activity; expenses are logged by hand; Dele reads a
-- real P&L. Customer lifetime value finally computes — the column has
-- waited since Phase 2 for this feeder.
--
-- HONEST ADAPTATION: the spec's revenue comes "automatically from
-- Stripe (training, camps, packages, memberships, season dues)" — but
-- the platform has NO Stripe integration, bookings, packages, or
-- memberships yet. What exists today that represents money is a lead
-- closed WON with an amount. So:
--   * closed_won lead → revenue_event (category mapped from interest),
--     linked to the lead and its customer. This composes with Phase 4:
--     wishlist YES → rep collects → marks won → revenue + commission.
--   * Manual revenue entry covers everything else (walk-up cash, dues
--     collected outside the app) until Stripe webhooks land (V2); the
--     stripe_* and booking/enrollment columns are reserved for that.
--   * MRR/memberships are NOT shown — there are no memberships to
--     count, and a fake zero reads as data.
--
-- Also ships: expenses CRUD, LTV wiring (revenue → customer rollups),
-- RLS on finance.* permissions. payroll_periods/lines shipped as a
-- shell in Phase 1; Phase 6 animates them.
-- ============================================================

create type revenue_category as enum
  ('club_season', 'camp', 'training_session', 'training_package',
   'membership', 'program', 'merchandise', 'other');

create type expense_category as enum
  ('payroll', 'facilities', 'equipment', 'travel',
   'tournament_fees', 'marketing', 'software', 'insurance',
   'food', 'other');

-- ============================================================
-- REVENUE
-- ============================================================

create table revenue_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  customer_id uuid references customers(id),
  category revenue_category not null,
  description text,
  amount_cents int not null,
  -- source links. lead_id is live today; the rest are reserved for the
  -- commerce tables and Stripe webhooks (V2) so this schema is stable.
  lead_id uuid references leads(id),
  booking_id uuid,
  package_purchase_id uuid,
  enrollment_id uuid,
  camp_id uuid references camps(id),
  stripe_payment_intent_id text,
  stripe_payout_id text,
  status text default 'collected' check (status in
    ('pending', 'collected', 'refunded')),
  entered_by uuid references profiles(id),  -- null = auto-generated
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

-- One auto revenue event per won lead (manual rows have null lead_id).
create unique index revenue_events_lead_uniq
  on revenue_events (lead_id) where lead_id is not null;
create index revenue_events_org_time_idx on revenue_events (org_id, occurred_at desc);
create index revenue_events_customer_idx on revenue_events (customer_id);

-- ============================================================
-- EXPENSES
-- ============================================================

create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  category expense_category not null,
  vendor text,
  description text,
  amount_cents int not null,
  expense_date date not null,
  receipt_url text,
  camp_id uuid references camps(id),        -- attribute to a camp
  recurring boolean default false,
  entered_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index expenses_org_date_idx on expenses (org_id, expense_date desc);

alter table revenue_events enable row level security;
alter table expenses       enable row level security;

-- ============================================================
-- RLS — finance.* permissions
-- ============================================================
-- Reads split by permission; writes go through finance.expenses.manage
-- (the finance data-entry permission — the catalog has no separate
-- revenue.manage, and the Finance set holds expenses.manage).

create policy "revenue_events_view"
  on revenue_events for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.revenue.view')
  );

create policy "revenue_events_manage"
  on revenue_events for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.expenses.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.expenses.manage')
  );

create policy "expenses_view"
  on expenses for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.expenses.view')
  );

create policy "expenses_manage"
  on expenses for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.expenses.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'finance.expenses.manage')
  );

-- ============================================================
-- LTV — the Phase-2 column gets its feeder
-- ============================================================
-- recompute_customer_rollups() now also sums collected revenue. The
-- whole function is redefined (CREATE OR REPLACE) with the Phase-2
-- lifecycle logic intact.

create or replace function public.recompute_customer_rollups(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_active_athletes int;
  v_active_campers int;
  v_had_any bool;
  v_stage text;
  v_current text;
  v_ltv int;
begin
  select count(*) into v_active_athletes
  from public.athletes a
  where a.customer_id = p_customer_id
    and a.is_active and a.current_team_id is not null;

  select count(*) into v_active_campers
  from public.campers cp
  join public.camps c on c.id = cp.camp_id
  where cp.customer_id = p_customer_id
    and not cp.converted_to_athlete
    and c.status in ('setup', 'active');

  select exists (
    select 1 from public.athletes a where a.customer_id = p_customer_id
    union all
    select 1 from public.campers cp where cp.customer_id = p_customer_id
  ) into v_had_any;

  select coalesce(sum(r.amount_cents), 0) into v_ltv
  from public.revenue_events r
  where r.customer_id = p_customer_id and r.status = 'collected';

  v_stage := case
    when v_active_athletes > 0 and v_active_campers > 0 then 'multi_program'
    when v_active_athletes > 0 then 'club_family'
    when v_active_campers > 0 then 'camper_family'
    when v_had_any then 'alumni'
    else 'lead'
  end;

  select lifecycle_stage into v_current
  from public.customers where id = p_customer_id;

  update public.customers
  set active_enrollments = v_active_athletes + v_active_campers,
      lifetime_value_cents = v_ltv,
      lifecycle_stage = case when v_current = 'churned' then 'churned' else v_stage end,
      updated_at = now()
  where id = p_customer_id;
end;
$$;

/** Any revenue change → the customer's rollups follow. */
create or replace function public.recompute_customer_on_revenue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.customer_id is not null then
    perform public.recompute_customer_rollups(new.customer_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE')
     and old.customer_id is not null
     and (tg_op = 'DELETE' or old.customer_id is distinct from new.customer_id) then
    perform public.recompute_customer_rollups(old.customer_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger revenue_events_recompute_customer
  after insert or update or delete on revenue_events
  for each row execute function public.recompute_customer_on_revenue();

-- ============================================================
-- CLOSED WON → REVENUE EVENT
-- ============================================================

/**
 * A lead closed won IS money collected (the rep collects before
 * marking won — there is no in-app checkout yet). Map the lead's
 * interest to a revenue category and record the event. Idempotent via
 * the unique lead_id index.
 */
create or replace function public.create_revenue_on_closed_won()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.stage <> 'closed_won' or old.stage = 'closed_won'
     or coalesce(new.won_amount_cents, 0) <= 0 then
    return new;
  end if;

  insert into public.revenue_events
    (org_id, customer_id, category, description, amount_cents,
     lead_id, camp_id, status, occurred_at)
  values
    (new.org_id,
     new.customer_id,
     case new.interest
       when 'club_season' then 'club_season'::revenue_category
       when 'camp' then 'camp'::revenue_category
       when 'training_1on1' then 'training_package'::revenue_category
       when 'training_group' then 'training_package'::revenue_category
       when 'clinic' then 'training_session'::revenue_category
       when 'program' then 'program'::revenue_category
       else 'other'::revenue_category
     end,
     'Closed won: ' || new.parent_name
       || coalesce(' (' || new.athlete_name || ')', ''),
     new.won_amount_cents,
     new.id, null, 'collected', coalesce(new.closed_at, now()))
  on conflict (lead_id) where lead_id is not null do nothing;

  return new;
end;
$$;

create trigger leads_revenue_on_won
  after update on leads
  for each row execute function public.create_revenue_on_closed_won();

revoke execute on function public.recompute_customer_on_revenue()
  from public, anon, authenticated;
revoke execute on function public.create_revenue_on_closed_won()
  from public, anon, authenticated;

-- ============================================================
-- Esface Business OS — Phase 2: CRM, the Customer Lifetime View
--
-- Every family is ONE customer record across their whole Esface life:
-- lead → camper family → club family → multi-program → alumni. The
-- program layer already has parents, athletes, campers; this migration
-- unifies them into a business-layer view and keeps them unified from
-- now on via triggers — program activity creates and links customer
-- records automatically, never by double entry.
--
-- Ships:
--   * lead_source enum (shared with Phase-3 leads)
--   * customers table + customer_id on athletes and campers
--   * ensure/link/recompute functions + AFTER INSERT triggers on
--     parent_athletes and campers (SECURITY DEFINER: program-side
--     writes must never depend on the writer's business permissions)
--   * one-time backfill of every existing family
--   * RLS: crm.customers.view to read, crm.customers.edit to write
--
-- Honest boundary: lifetime_value_cents stays 0 for now. The platform
-- has NO payment tables yet — revenue_events arrive in Phase 5, and
-- recompute_customer_rollups() gains the LTV sum there. Lifecycle and
-- enrollment counts are computed from real program data today.
-- ============================================================

-- Shared with Phase 3 (leads.source, customers.first_touch_source).
create type lead_source as enum
  ('camp', 'clinic_dropin', 'website', 'referral',
   'wishlist_request', 'walk_in', 'social', 'event',
   'tryout_eval', 'outreach', 'other');

-- ============================================================
-- CUSTOMERS
-- ============================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  -- identity (the family / paying parent)
  primary_parent_profile_id uuid references profiles(id),
  family_name text not null,
  email text,
  phone text,
  -- lifecycle
  lifecycle_stage text default 'lead' check (lifecycle_stage in
    ('lead', 'camper_family', 'training_customer',
     'club_family', 'multi_program', 'alumni', 'churned')),
  first_touch_source lead_source,
  first_touch_date date,
  -- value (LTV fed by revenue_events in Phase 5)
  lifetime_value_cents int default 0,
  active_enrollments int default 0,
  -- risk (auto-flags are a Phase-3 retention motion; fields live here)
  retention_risk text default 'none' check (retention_risk in
    ('none', 'watch', 'at_risk')),
  retention_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One customer per parent profile; one per email for profile-less
-- camper families (case-insensitive).
create unique index customers_parent_uniq
  on customers (org_id, primary_parent_profile_id)
  where primary_parent_profile_id is not null;
create unique index customers_email_uniq
  on customers (org_id, lower(email))
  where primary_parent_profile_id is null and email is not null;
create index customers_org_stage_idx on customers (org_id, lifecycle_stage);

alter table athletes add column customer_id uuid references customers(id);
alter table campers  add column customer_id uuid references customers(id);
create index athletes_customer_idx on athletes (customer_id);
create index campers_customer_idx  on campers (customer_id);

alter table customers enable row level security;

-- ============================================================
-- RLS — crm.customers.view / crm.customers.edit
-- ============================================================

create policy "customers_view"
  on customers for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'crm.customers.view')
  );

create policy "customers_edit"
  on customers for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'crm.customers.edit')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'crm.customers.edit')
  );

-- ============================================================
-- UNIFICATION MACHINERY
-- ============================================================
-- SECURITY DEFINER throughout: these run from program-layer writes
-- (linking a parent, adding a camper) whose authors — coaches, admins —
-- usually hold no business permissions at all. Customer records are a
-- side effect of the program running, so they must never be blocked by
-- the writer's own RLS standing on `customers`.

/** Get-or-create the customer record for a parent profile. */
create or replace function public.ensure_customer_for_parent(p_parent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
  v_org_id uuid;
  v_family_name text;
  v_email text;
  v_phone text;
begin
  select c.id into v_customer_id
  from public.customers c
  where c.primary_parent_profile_id = p_parent_id;
  if v_customer_id is not null then return v_customer_id; end if;

  select pr.org_id, nullif(trim(pr.last_name), ''), pr.phone
    into v_org_id, v_family_name, v_phone
  from public.profiles pr where pr.id = p_parent_id;
  if v_org_id is null then return null; end if;

  select u.email into v_email from auth.users u where u.id = p_parent_id;

  insert into public.customers
    (org_id, primary_parent_profile_id, family_name, email, phone)
  values
    (v_org_id, p_parent_id,
     coalesce(v_family_name, 'Family'), v_email, v_phone)
  on conflict (org_id, primary_parent_profile_id)
    where primary_parent_profile_id is not null
    do update set updated_at = now()
  returning id into v_customer_id;

  return v_customer_id;
end;
$$;

/**
 * Recompute a customer's derived fields from program data:
 * lifecycle_stage and active_enrollments. LTV joins in Phase 5 when
 * revenue_events exists. Never downgrades an explicit 'churned'.
 */
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
      lifecycle_stage = case when v_current = 'churned' then 'churned' else v_stage end,
      updated_at = now()
  where id = p_customer_id;
end;
$$;

/** parent_athletes INSERT → ensure the customer, link the athlete. */
create or replace function public.link_customer_on_parent_athlete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
begin
  v_customer_id := public.ensure_customer_for_parent(new.parent_id);
  if v_customer_id is null then return new; end if;

  update public.athletes
  set customer_id = v_customer_id
  where id = new.athlete_id and customer_id is null;

  perform public.recompute_customer_rollups(v_customer_id);
  return new;
end;
$$;

create trigger parent_athletes_link_customer
  after insert on parent_athletes
  for each row execute function public.link_customer_on_parent_athlete();

/**
 * campers INSERT → find the family by parent email (or the athlete link
 * when the camper is already tied to a club family), else create a
 * profile-less camper-family customer. First touch: camp.
 */
create or replace function public.link_customer_on_camper()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
begin
  -- Already part of a club family via the linked athlete?
  if new.athlete_id is not null then
    select a.customer_id into v_customer_id
    from public.athletes a where a.id = new.athlete_id;
  end if;

  -- Match an existing customer by parent email.
  if v_customer_id is null then
    select c.id into v_customer_id
    from public.customers c
    where c.org_id = new.org_id
      and c.email is not null
      and lower(c.email) = lower(new.parent_email)
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers
      (org_id, family_name, email, lifecycle_stage,
       first_touch_source, first_touch_date)
    values
      (new.org_id, coalesce(nullif(trim(new.last_name), ''), 'Family'),
       new.parent_email, 'camper_family', 'camp', current_date)
    on conflict (org_id, lower(email))
      where primary_parent_profile_id is null and email is not null
      do update set updated_at = now()
    returning id into v_customer_id;
  end if;

  update public.campers
  set customer_id = v_customer_id
  where id = new.id and customer_id is null;

  perform public.recompute_customer_rollups(v_customer_id);
  return new;
end;
$$;

create trigger campers_link_customer
  after insert on campers
  for each row execute function public.link_customer_on_camper();

revoke execute on function public.ensure_customer_for_parent(uuid)
  from public, anon, authenticated;
revoke execute on function public.recompute_customer_rollups(uuid)
  from public, anon, authenticated;
revoke execute on function public.link_customer_on_parent_athlete()
  from public, anon, authenticated;
revoke execute on function public.link_customer_on_camper()
  from public, anon, authenticated;
grant execute on function public.ensure_customer_for_parent(uuid) to service_role;
grant execute on function public.recompute_customer_rollups(uuid) to service_role;

-- ============================================================
-- BACKFILL — unify every family that exists today
-- ============================================================

do $$
declare
  r record;
  v_customer_id uuid;
begin
  -- 1. Every linked parent becomes (or already is) a customer; their
  --    athletes link to the family record.
  for r in select distinct parent_id from parent_athletes loop
    v_customer_id := public.ensure_customer_for_parent(r.parent_id);
    if v_customer_id is not null then
      update public.athletes a
      set customer_id = v_customer_id
      where a.customer_id is null
        and a.id in (select pa.athlete_id from public.parent_athletes pa
                     where pa.parent_id = r.parent_id);
    end if;
  end loop;

  -- 2. Campers: join their athlete's family, an email-matched family,
  --    or a fresh camper-family record (first touch: camp).
  for r in select * from campers where customer_id is null loop
    v_customer_id := null;

    if r.athlete_id is not null then
      select a.customer_id into v_customer_id
      from public.athletes a where a.id = r.athlete_id;
    end if;

    if v_customer_id is null then
      select c.id into v_customer_id
      from public.customers c
      where c.org_id = r.org_id
        and c.email is not null
        and lower(c.email) = lower(r.parent_email)
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers
        (org_id, family_name, email, lifecycle_stage,
         first_touch_source, first_touch_date)
      values
        (r.org_id, coalesce(nullif(trim(r.last_name), ''), 'Family'),
         r.parent_email, 'camper_family', 'camp', current_date)
      returning id into v_customer_id;
    end if;

    update public.campers set customer_id = v_customer_id where id = r.id;
  end loop;

  -- 3. Roll every customer up from real program data.
  for r in select id from customers loop
    perform public.recompute_customer_rollups(r.id);
  end loop;
end $$;

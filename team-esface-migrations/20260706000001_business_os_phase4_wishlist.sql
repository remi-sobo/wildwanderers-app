-- ============================================================
-- Esface Business OS — Phase 4: The Wishlist (Athlete-Driven Demand)
--
-- Kids browse what Esface offers and ask their parent for it. Every
-- request is a warm lead in the sales pipeline, auto-assigned to the
-- family's coach-rep. The athlete becomes the demand generator.
--
-- Ships:
--   * wishlist_offerings — the browsable catalog. HONEST ADAPTATION:
--     the spec references training_offerings/training_packages and a
--     Training Module checkout, none of which exist in the platform
--     yet. This catalog is the V1 stand-in HQ curates; when real
--     commerce ships (Phase 5+/V2) offerings migrate onto it.
--   * wishlist_requests + wishlist_mutes, wishlist_status enum
--   * guardrails in a BEFORE INSERT trigger: max 2 open requests per
--     athlete, parent can mute; 14-day expiry via expire_stale
--     function called by the reading surfaces (lazy, no cron needed)
--   * request INSERT → warm lead (source wishlist_request) assigned
--     to the family's coach-rep (head coach of the athlete's current
--     team, when that coach holds an active staff position)
--   * parent response → lead stage: accepted → engaged with a
--     collect-payment next action (no in-app checkout yet); declined
--     → nurture
--   * notification types for the parent ping and the rep loop
-- ============================================================

create type wishlist_status as enum
  ('requested', 'seen', 'purchased', 'declined', 'expired');

alter type notification_type add value if not exists 'wishlist_request';
alter type notification_type add value if not exists 'wishlist_response';

-- ============================================================
-- OFFERINGS — what a kid can ask for
-- ============================================================

create table wishlist_offerings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,                  -- "1-on-1 Training · 5-Pack"
  description text,                    -- "Private sessions focused on your game"
  emoji text default '🏀',
  price_cents int,
  interest interest_type not null,     -- feeds the lead + commission rule match
  camp_id uuid references camps(id),   -- when the offering IS a camp
  /** MBHS pillar/subcategory slugs this offering helps with; used to
      surface "Coach said you're working on X — these would help". */
  helps_with text[] default '{}',
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index wishlist_offerings_org_idx on wishlist_offerings (org_id, is_active, sort_order);

-- ============================================================
-- REQUESTS + MUTES
-- ============================================================

create table wishlist_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  athlete_id uuid references athletes(id) not null,
  parent_id uuid references profiles(id) not null,
  -- what they want
  offering_id uuid references wishlist_offerings(id),
  camp_id uuid references camps(id),
  item_name text not null,             -- snapshot: offering may change later
  item_price_cents int,
  -- the kid's pitch
  athlete_message text,
  status wishlist_status default 'requested',
  seen_at timestamptz,
  resolved_at timestamptz,
  lead_id uuid references leads(id),   -- auto-created warm lead
  created_at timestamptz default now()
);

create index wishlist_requests_athlete_idx on wishlist_requests (athlete_id, status);
create index wishlist_requests_parent_idx on wishlist_requests (parent_id, status);

-- Parents can pause the firehose. A row here = requests to this parent
-- are muted; athletes see that and can't send.
create table wishlist_mutes (
  parent_id uuid primary key references profiles(id),
  muted_at timestamptz default now()
);

alter table wishlist_offerings enable row level security;
alter table wishlist_requests  enable row level security;
alter table wishlist_mutes     enable row level security;

-- ============================================================
-- RLS
-- ============================================================

-- Offerings: every signed-in org member can browse what's active
-- (athletes shop here); managing the catalog is business settings.
create policy "wishlist_offerings_read"
  on wishlist_offerings for select
  using (org_id = get_user_org());

create policy "wishlist_offerings_manage"
  on wishlist_offerings for all
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'business.settings.manage')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'business.settings.manage')
  );

-- Requests: the athlete creates and reads their own; the parent reads
-- and answers requests addressed to them; the sales side (view_all)
-- reads for pipeline context.
-- current_user_athlete_id() is the platform's SECURITY DEFINER helper —
-- a plain athletes subquery here would re-enter the athletes RLS and
-- deny the insert for athletes without a self-read policy.
create policy "wishlist_requests_athlete_own"
  on wishlist_requests for select
  using (athlete_id = current_user_athlete_id());

create policy "wishlist_requests_athlete_insert"
  on wishlist_requests for insert
  with check (
    org_id = get_user_org()
    and athlete_id = current_user_athlete_id()
  );

create policy "wishlist_requests_parent"
  on wishlist_requests for select
  using (parent_id = (select auth.uid()));

create policy "wishlist_requests_parent_respond"
  on wishlist_requests for update
  using (parent_id = (select auth.uid()))
  with check (parent_id = (select auth.uid()));

create policy "wishlist_requests_sales_read"
  on wishlist_requests for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'sales.pipeline.view_all')
  );

-- Mutes: the parent manages their own row; athletes need to know the
-- door is closed, so reads are open to the org (a boolean, not PII).
create policy "wishlist_mutes_read"
  on wishlist_mutes for select
  using (true);

create policy "wishlist_mutes_own"
  on wishlist_mutes for all
  using (parent_id = (select auth.uid()))
  with check (parent_id = (select auth.uid()));

-- ============================================================
-- GUARDRAILS — before a request is born
-- ============================================================

create or replace function public.enforce_wishlist_guardrails()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_open int;
begin
  if exists (select 1 from public.wishlist_mutes m where m.parent_id = new.parent_id) then
    raise exception 'WISHLIST_MUTED' using errcode = 'P0001';
  end if;

  select count(*) into v_open
  from public.wishlist_requests r
  where r.athlete_id = new.athlete_id
    and r.status in ('requested', 'seen');
  if v_open >= 2 then
    raise exception 'WISHLIST_LIMIT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger wishlist_guardrails
  before insert on wishlist_requests
  for each row execute function public.enforce_wishlist_guardrails();

/**
 * Expire open requests older than 14 days. Called lazily by the
 * surfaces that read requests (athlete Level Up, parent Requests) —
 * no cron dependency. Their linked leads move to nurture.
 */
create or replace function public.expire_stale_wishlist_requests()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.leads l
  set stage = 'nurture', updated_at = now()
  where l.id in (
    select r.lead_id from public.wishlist_requests r
    where r.status in ('requested', 'seen')
      and r.created_at < now() - interval '14 days'
      and r.lead_id is not null
  ) and l.stage not in ('closed_won', 'closed_lost');

  update public.wishlist_requests
  set status = 'expired', resolved_at = now()
  where status in ('requested', 'seen')
    and created_at < now() - interval '14 days';
end;
$$;

-- ============================================================
-- THE PIPELINE HOOK — every request is a warm lead
-- ============================================================

/**
 * Request INSERT → warm lead assigned to the family's coach-rep: the
 * head coach of the athlete's current team, if that coach holds an
 * active staff position. Falls back to unassigned (the sales lead
 * assigns from the board).
 */
create or replace function public.create_lead_on_wishlist_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_athlete record;
  v_offering_interest interest_type;
  v_parent_name text;
  v_parent_email text;
  v_rep uuid;
  v_lead_id uuid;
begin
  select a.first_name, a.last_name, a.grade, a.customer_id, a.current_team_id
  into v_athlete
  from public.athletes a where a.id = new.athlete_id;

  select coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'Parent')
  into v_parent_name
  from public.profiles p where p.id = new.parent_id;
  select u.email into v_parent_email from auth.users u where u.id = new.parent_id;

  if new.offering_id is not null then
    select interest into v_offering_interest
    from public.wishlist_offerings where id = new.offering_id;
  end if;

  -- The family's coach-rep: current team's head coach with a staff row.
  if v_athlete.current_team_id is not null then
    select sm.id into v_rep
    from public.teams t
    join public.staff_members sm on sm.profile_id = t.head_coach_id and sm.is_active
    where t.id = v_athlete.current_team_id;
  end if;

  insert into public.leads
    (org_id, parent_name, parent_email, athlete_name, athlete_grade,
     customer_id, athlete_id, source, interest, interest_detail,
     estimated_value_cents, stage, assigned_to, next_action,
     next_action_date, dedupe_key)
  values
    (new.org_id, v_parent_name, v_parent_email,
     v_athlete.first_name || ' ' || v_athlete.last_name, v_athlete.grade,
     v_athlete.customer_id, new.athlete_id, 'wishlist_request',
     coalesce(v_offering_interest, 'multiple'),
     v_athlete.first_name || ' asked for: ' || new.item_name
       || coalesce(' — "' || new.athlete_message || '"', ''),
     new.item_price_cents, 'new', v_rep,
     'Follow up on ' || v_athlete.first_name || '''s wishlist request',
     (current_date + 3),
     'wishlist:' || new.id)
  on conflict (dedupe_key) do nothing
  returning id into v_lead_id;

  if v_lead_id is not null then
    update public.wishlist_requests set lead_id = v_lead_id where id = new.id;
  end if;

  return new;
end;
$$;

create trigger wishlist_requests_create_lead
  after insert on wishlist_requests
  for each row execute function public.create_lead_on_wishlist_request();

/**
 * Parent responds → the lead follows. Accepted ('purchased') → engaged,
 * with a collect-payment next action for the rep (there is no in-app
 * checkout yet — the rep or HQ closes payment and marks the lead won,
 * which is what fires the commission). Declined → nurture.
 */
create or replace function public.update_lead_on_wishlist_response()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.lead_id is null or new.status = old.status then return new; end if;

  if new.status = 'purchased' then
    update public.leads
    set stage = 'engaged',
        next_action = 'Parent said YES — collect payment and set up ' || new.item_name,
        next_action_date = current_date,
        updated_at = now()
    where id = new.lead_id and stage not in ('closed_won', 'closed_lost');
  elsif new.status = 'declined' then
    update public.leads
    set stage = 'nurture', updated_at = now()
    where id = new.lead_id and stage not in ('closed_won', 'closed_lost');
  end if;

  return new;
end;
$$;

create trigger wishlist_requests_update_lead
  after update on wishlist_requests
  for each row execute function public.update_lead_on_wishlist_response();

revoke execute on function public.enforce_wishlist_guardrails()
  from public, anon, authenticated;
revoke execute on function public.create_lead_on_wishlist_request()
  from public, anon, authenticated;
revoke execute on function public.update_lead_on_wishlist_response()
  from public, anon, authenticated;
-- expire_stale runs from app surfaces under any signed-in session.
revoke execute on function public.expire_stale_wishlist_requests() from public, anon;
grant  execute on function public.expire_stale_wishlist_requests() to authenticated, service_role;

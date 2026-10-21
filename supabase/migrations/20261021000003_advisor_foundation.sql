-- ============================================================
-- Wild Wanderers — advisor foundation (specs/advisor.md)
--
-- An advisor works with an owner on the business. They see only what
-- this migration grants, and the database enforces it:
--
--   advisor_relationships  which org an advisor works with (owner-managed)
--   advisor_shares         what the owner chose to share (owner-managed)
--   advisor_items          the advisor's own to-dos, deliverables and
--                          questions; 'private' rows never reach the owner
--   business_tasks         three new columns: kind (task, assignment,
--                          suggestion), assigned_by, shared_with_advisor
--
-- An advisor profile carries no org_id, so get_user_org() is null for
-- them and every existing org-scoped policy (clients, wellness, kids,
-- families, forms, messages, finance, leads, tasks, schedule) fails
-- closed. The advisor never selects business_tasks directly: they read
-- a masked projection through advisor_tasks() and create work for the
-- owner through advisor_assign_task(), which is retry-safe on a request
-- id. A task linked to a client, lead, customer or the kids program
-- shows to the advisor as "A client task" with no details and no ids.
-- ============================================================

-- ── advisor_relationships ─────────────────────────────────────
create table advisor_relationships (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id),
  -- What the owner calls them in the app; the owner cannot read an
  -- advisor's profile row (it has no org).
  advisor_name text not null default '' check (length(advisor_name) <= 120),
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (advisor_id, org_id)
);
create index advisor_relationships_org_idx on advisor_relationships (org_id) where active;

-- The orgs the calling advisor actively works with. Definer, so the
-- policies below can use it without reading profiles under RLS.
create or replace function public.advisor_org_ids()
returns uuid[]
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(r.org_id), '{}'::uuid[])
  from public.advisor_relationships r
  join public.profiles p on p.id = r.advisor_id
  where r.advisor_id = auth.uid() and r.active and p.role = 'advisor'
$$;
revoke execute on function public.advisor_org_ids() from public, anon;
grant execute on function public.advisor_org_ids() to authenticated;

alter table advisor_relationships enable row level security;

create policy "owner_manages_advisor_relationships" on advisor_relationships for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "advisor_reads_own_relationships" on advisor_relationships for select
  using (advisor_id = auth.uid() and get_user_role() = 'advisor');

-- ── advisor_shares ────────────────────────────────────────────
create table advisor_shares (
  org_id uuid not null references organizations(id),
  key text not null check (key in ('goals', 'five', 'tasks', 'schedule', 'numbers')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

alter table advisor_shares enable row level security;

create policy "owner_manages_advisor_shares" on advisor_shares for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "advisor_reads_shares" on advisor_shares for select
  using (get_user_role() = 'advisor' and org_id = any (advisor_org_ids()));

-- ── advisor_items ─────────────────────────────────────────────
create table advisor_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  advisor_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  -- todo: the advisor's own work. deliverable: something they owe the
  -- owner. question: something they are waiting on the owner for.
  kind text not null default 'todo' check (kind in ('todo', 'deliverable', 'question')),
  title text not null check (length(btrim(title)) between 1 and 300),
  notes text check (notes is null or length(notes) <= 5000),
  vis text not null default 'private' check (vis in ('private', 'shared')),
  stage text check (stage in ('drafting', 'ready', 'shared')),
  status text not null default 'open' check (status in ('open', 'done', 'dropped')),
  due_date date,
  -- Client-generated per compose, so a retry never makes a second row.
  request_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index advisor_items_owner_idx on advisor_items (advisor_id, status);
create index advisor_items_org_shared_idx on advisor_items (org_id) where vis = 'shared';

create or replace function public.advisor_items_touch()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.advisor_items_touch() from public, anon, authenticated;

create trigger advisor_items_touch
  before update on advisor_items
  for each row execute function public.advisor_items_touch();

alter table advisor_items enable row level security;

create policy "advisor_manages_own_items" on advisor_items for all
  using (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and org_id = any (advisor_org_ids())
  )
  with check (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and org_id = any (advisor_org_ids())
  );
-- The owner sees only what the advisor marked shared. Private rows
-- have no owner policy at all.
create policy "owner_reads_shared_advisor_items" on advisor_items for select
  using (org_id = get_user_org() and get_user_role() = 'owner' and vis = 'shared');

-- ── business_tasks: who it came from, and what kind ───────────
alter table business_tasks
  add column kind text not null default 'task'
    check (kind in ('task', 'assignment', 'suggestion')),
  add column assigned_by uuid references profiles(id),
  add column shared_with_advisor boolean not null default false;
create index business_tasks_assigned_by_idx on business_tasks (assigned_by) where assigned_by is not null;

-- ── advisor reads: the orgs they work with ────────────────────
create or replace function public.advisor_orgs()
returns table (org_id uuid, org_name text, owner_first_name text)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select o.id, o.name,
    (select p.first_name from public.profiles p
      where p.org_id = o.id and p.role = 'owner' order by p.created_at limit 1)
  from public.organizations o
  where get_user_role() = 'advisor' and o.id = any (advisor_org_ids())
$$;
revoke execute on function public.advisor_orgs() from public, anon;
grant execute on function public.advisor_orgs() to authenticated;

-- ── advisor reads: tasks they assigned, and tasks shared with them ─
-- A masked projection, never the raw row: no link ids, no assignee,
-- and a task linked to a client, lead, customer or the kids program
-- shows no title or description.
create or replace function public.advisor_tasks()
returns table (
  id uuid,
  org_id uuid,
  title text,
  description text,
  status task_status,
  due_date date,
  kind text,
  from_me boolean,
  masked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select
    t.id,
    t.org_id,
    case when m.masked then 'A client task · details not shared with you' else t.title end,
    case when m.masked then null else t.description end,
    t.status,
    t.due_date,
    t.kind,
    t.assigned_by is not distinct from auth.uid(),
    m.masked,
    t.created_at,
    t.updated_at,
    t.completed_at
  from public.business_tasks t
  cross join lateral (
    select (t.client_id is not null or t.lead_id is not null
            or t.customer_id is not null or t.program_id is not null) as masked
  ) m
  where get_user_role() = 'advisor'
    and t.org_id = any (advisor_org_ids())
    and (
      t.assigned_by = auth.uid()
      or (
        t.shared_with_advisor
        and exists (
          select 1 from public.advisor_shares s
          where s.org_id = t.org_id and s.key = 'tasks' and s.enabled
        )
      )
    )
$$;
revoke execute on function public.advisor_tasks() from public, anon;
grant execute on function public.advisor_tasks() to authenticated;

-- ── advisor writes: assign or suggest a task to the owner ─────
-- One business_tasks row per request id, however many times it is
-- sent: the id becomes the task's dedupe_key, which is unique. A
-- suggestion stays out of the owner's task list until they accept it.
create or replace function public.advisor_assign_task(
  p_org_id uuid,
  p_title text,
  p_description text,
  p_due_date date,
  p_kind text,
  p_request_id uuid
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid;
  v_id uuid;
  v_key text;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if get_user_role() is distinct from 'advisor' or not (p_org_id = any (advisor_org_ids())) then
    raise exception 'ADVISOR_FORBIDDEN' using errcode = '42501';
  end if;
  if p_kind not in ('assignment', 'suggestion') then
    raise exception 'ADVISOR_BAD_KIND' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'ADVISOR_NO_REQUEST_ID' using errcode = '22023';
  end if;
  if length(v_title) < 1 or length(v_title) > 300 then
    raise exception 'ADVISOR_BAD_TITLE' using errcode = '22023';
  end if;
  if p_description is not null and length(p_description) > 5000 then
    raise exception 'ADVISOR_BAD_DESCRIPTION' using errcode = '22023';
  end if;

  select p.id into v_owner from public.profiles p
  where p.org_id = p_org_id and p.role = 'owner'
  order by p.created_at limit 1;
  if v_owner is null then
    raise exception 'ADVISOR_NO_OWNER' using errcode = '23503';
  end if;

  v_key := 'advisor:' || p_request_id::text;

  insert into public.business_tasks (
    org_id, title, description, due_date, kind, assigned_by, assigned_to,
    created_by, program, category, priority, source_type, dedupe_key
  ) values (
    p_org_id, v_title, nullif(btrim(coalesce(p_description, '')), ''), p_due_date, p_kind,
    auth.uid(), v_owner, auth.uid(), 'general', 'other', 'medium', 'advisor', v_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    select t.id into v_id from public.business_tasks t
    where t.dedupe_key = v_key and t.org_id = p_org_id and t.assigned_by = auth.uid();
  end if;
  if v_id is null then
    raise exception 'ADVISOR_FORBIDDEN' using errcode = '42501';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.advisor_assign_task(uuid, text, text, date, text, uuid) from public, anon;
grant execute on function public.advisor_assign_task(uuid, text, text, date, text, uuid) to authenticated;

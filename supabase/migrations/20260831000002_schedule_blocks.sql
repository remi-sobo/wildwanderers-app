-- ============================================================
-- Wild Wanderers — Schedule: weekly time blocking with task-filled
-- work blocks (design_handoff_schedule)
--
-- Template-week model: blocks are weekly recurring by nature, real
-- dates are derived. Blocks sharing grp are one event on several days.
-- schedule_block_tasks publishes tasks into a work block for one real
-- week (keyed by that week's Monday), so every Monday the work blocks
-- start empty while the blocks themselves persist. schedule_settings
-- holds each staff member's grid preferences.
--
-- One deviation from the handoff schema, on purpose: every table
-- carries org_id. Tenancy is a binding platform rule (CLAUDE.md);
-- a schedule never crosses orgs.
-- ============================================================

create table schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  -- The repeat group: blocks sharing grp are one weekly event on
  -- several days. A single-day block still gets its own grp.
  grp uuid not null default gen_random_uuid(),
  day smallint not null check (day between 0 and 6),          -- 0 = Monday
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min <= 1440),
  title text not null,
  location text,
  description text,
  block_type text not null default 'client'
    check (block_type in ('client', 'group', 'ww', 'admin', 'personal', 'travel')),
  recur text not null default 'weekly'
    check (recur in ('weekly', 'biweekly', 'monthly', 'once')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
create index schedule_blocks_org_idx on schedule_blocks (org_id, day, start_min);
create index schedule_blocks_grp_idx on schedule_blocks (grp);

create table schedule_block_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  block_id uuid references schedule_blocks(id) on delete cascade not null,
  task_id uuid references business_tasks(id) on delete cascade not null,
  week_start date not null,                                   -- Monday of the real week
  position int not null default 0,
  created_at timestamptz not null default now(),
  -- A task lives on one block at a time within a week; moving it is an
  -- upsert on this key.
  unique (task_id, week_start)
);
create index schedule_block_tasks_block_idx on schedule_block_tasks (block_id, week_start, position);

create table schedule_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  org_id uuid references organizations(id) not null,
  start_hour numeric not null default 6,
  end_hour numeric not null default 22.5,
  travel_buffer_min int not null default 30,
  default_len_min int not null default 30,
  default_block_type text not null default 'client'
    check (default_block_type in ('client', 'group', 'ww', 'admin', 'personal', 'travel')),
  colors jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Only a Work block ('admin') carries tasks; the database holds the
-- line so no write path can drift.
create or replace function guard_block_task_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from schedule_blocks b
    where b.id = new.block_id and b.block_type = 'admin'
  ) then
    raise exception 'NOT_A_WORK_BLOCK' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function guard_block_task_target() from public, anon, authenticated;

create trigger schedule_block_tasks_guard
  before insert or update on schedule_block_tasks
  for each row execute function guard_block_task_target();

-- ── RLS: staff only, same shape as business_tasks ──────────
-- Owner manages the org's schedule; a coach manages what they created.
-- Clients and parents reach nothing.
alter table schedule_blocks      enable row level security;
alter table schedule_block_tasks enable row level security;
alter table schedule_settings    enable row level security;

create policy "owner_manages_schedule_blocks" on schedule_blocks for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "coach_own_schedule_blocks" on schedule_blocks for all
  using (
    org_id = get_user_org() and get_user_role() = 'coach'
    and created_by = auth.uid()
  )
  with check (
    org_id = get_user_org() and get_user_role() = 'coach'
    and created_by = auth.uid()
  );

-- Task links ride the block's visibility: the subquery runs under the
-- caller's own block policies, the same pattern as task_comments.
create policy "staff_block_tasks_via_block" on schedule_block_tasks for all
  using (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from schedule_blocks b where b.id = block_id)
  )
  with check (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from schedule_blocks b where b.id = block_id)
  );

create policy "staff_own_schedule_settings" on schedule_settings for all
  using (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
  )
  with check (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
  );

-- ============================================================
-- SEED — Gabe's current week from the handoff, block for block.
-- Client 1:1 names are labeled placeholders he edits in-app; nothing
-- invented. The known gap he accepted stays: the MWF 10 to 12 client
-- runs straight into kid time at 12:00 with no travel gap. Org-scoped,
-- created by the org's owner; an org without an owner seeds nothing.
-- ============================================================
do $$
declare
  v_org uuid;
  v_owner uuid;
begin
  for v_org, v_owner in
    select o.id,
      (select p.id from profiles p where p.org_id = o.id and p.role = 'owner' limit 1)
    from organizations o
  loop
    continue when v_owner is null;

    -- Mon Wed Fri
    insert into schedule_blocks (org_id, grp, day, start_min, end_min, title, description, block_type, created_by)
    select v_org, g.grp, d.day, g.s, g.e, g.title, g.descr, g.btype, v_owner
    from (values
      (gen_random_uuid(), 390, 450,  'Remi 1:1',           null::text,                'client'),
      (gen_random_uuid(), 450, 480,  'Travel',             null,                      'travel'),
      (gen_random_uuid(), 510, 570,  'Client 1:1',         'Client name to confirm',  'client'),
      (gen_random_uuid(), 570, 600,  'Travel',             null,                      'travel'),
      (gen_random_uuid(), 600, 720,  'Client 1:1',         'Client name to confirm',  'client'),
      (gen_random_uuid(), 720, 900,  'Time with the kids', null,                      'personal')
    ) as g(grp, s, e, title, descr, btype)
    cross join (values (0), (2), (4)) as d(day);

    -- Tue Thu
    insert into schedule_blocks (org_id, grp, day, start_min, end_min, title, description, block_type, created_by)
    select v_org, g.grp, d.day, g.s, g.e, g.title, g.descr, g.btype, v_owner
    from (values
      (gen_random_uuid(), 450, 570,   'Family small group', null::text,               'group'),
      (gen_random_uuid(), 990, 1050,  'Client 1:1',         'Client name to confirm', 'client')
    ) as g(grp, s, e, title, descr, btype)
    cross join (values (1), (3)) as d(day);

    -- Single days
    insert into schedule_blocks (org_id, grp, day, start_min, end_min, title, description, block_type, created_by)
    values
      (v_org, gen_random_uuid(), 1, 630, 810, 'Time with the kids',  null, 'personal', v_owner),
      (v_org, gen_random_uuid(), 3, 670, 730, 'MyGym with the kids', null, 'personal', v_owner),
      (v_org, gen_random_uuid(), 3, 730, 750, 'Time with the kids',  'Kids hand-off ends 12:30', 'personal', v_owner),
      (v_org, gen_random_uuid(), 5, 540, 660, 'Family small group',  null, 'group', v_owner);
  end loop;
end;
$$;

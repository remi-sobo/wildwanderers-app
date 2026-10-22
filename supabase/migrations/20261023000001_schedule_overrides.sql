-- ============================================================
-- Wild Wanderers — Schedule, Phase 4b: one-day moves, real repeats,
-- and busy holds (specs/schedule-overrides.md)
--
-- schedule_blocks stays the template week. Three additive changes:
--
-- 1. schedule_block_overrides: one dated occurrence of a block moved to
--    another time, or another day of the same week. The template row is
--    untouched, so next week's occurrence stays where it was. Keyed by
--    the occurrence's original date; one override per block per date.
-- 2. schedule_blocks.anchor_week: the Monday a non-weekly repeat counts
--    from. Every other week, monthly and one time were labels only
--    before; with an anchor they recur on the right weeks. Null keeps the
--    old behavior (every week), so no existing block changes. Every
--    production block is weekly today.
-- 3. A 'hold' block type for busy time that is not a session.
--
-- RLS follows schedule_block_tasks: an override rides its block's
-- visibility, so the owner reaches the org's blocks and a coach their
-- own. Clients, parents and advisors reach nothing.
-- ============================================================

-- ── Busy holds ─────────────────────────────────────────────
alter table schedule_blocks drop constraint schedule_blocks_block_type_check;
alter table schedule_blocks add constraint schedule_blocks_block_type_check
  check (block_type in ('client', 'group', 'ww', 'admin', 'personal', 'travel', 'hold'));

alter table schedule_settings drop constraint schedule_settings_default_block_type_check;
alter table schedule_settings add constraint schedule_settings_default_block_type_check
  check (default_block_type in ('client', 'group', 'ww', 'admin', 'personal', 'travel', 'hold'));

-- ── Repeat anchor ──────────────────────────────────────────
alter table schedule_blocks add column anchor_week date
  check (anchor_week is null or extract(isodow from anchor_week) = 1);

-- ── One-day overrides ──────────────────────────────────────
create table schedule_block_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  block_id uuid references schedule_blocks(id) on delete cascade not null,
  on_date date not null,                                      -- the occurrence's own date
  new_date date not null,                                     -- where it sits that week
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min <= 1440),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_min > start_min),
  -- A one-day move stays inside its own week (Monday to Sunday).
  check (new_date - extract(isodow from new_date)::int = on_date - extract(isodow from on_date)::int),
  unique (block_id, on_date)
);
create index schedule_block_overrides_org_idx on schedule_block_overrides (org_id, new_date);

-- The occurrence date must fall on the block's weekday, and the org
-- must be the block's org, so no write path can drift.
create or replace function guard_block_override()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from schedule_blocks b
    where b.id = new.block_id
      and b.org_id = new.org_id
      and b.day = extract(isodow from new.on_date)::int - 1
  ) then
    raise exception 'OVERRIDE_NOT_ON_BLOCK_DAY' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function guard_block_override() from public, anon, authenticated;

create trigger schedule_block_overrides_guard
  before insert or update on schedule_block_overrides
  for each row execute function guard_block_override();

alter table schedule_block_overrides enable row level security;

create policy "staff_block_overrides_via_block" on schedule_block_overrides for all
  using (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from schedule_blocks b where b.id = block_id)
  )
  with check (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from schedule_blocks b where b.id = block_id)
  );

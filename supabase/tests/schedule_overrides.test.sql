-- One-day schedule moves, repeat anchors and busy holds (migration
-- 20261023000001_schedule_overrides): a one-day move leaves the template
-- alone, stays in its week and on its block's weekday, and only the
-- block's own staff can see or write it.

\set ON_ERROR_STOP 1
\o /dev/null

insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'client@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'parent@test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'advisor@test', '{}');
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'coach'  where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'client' where id = '00000000-0000-0000-0000-0000000000a3';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'parent' where id = '00000000-0000-0000-0000-0000000000a4';
update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000b1';
update profiles set role = 'advisor' where id = '00000000-0000-0000-0000-0000000000e1';
insert into advisor_relationships (advisor_id, org_id) values ('00000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a');

-- day 3 is Thursday. 2026-10-22 is a Thursday in the week of Monday 2026-10-19.
insert into schedule_blocks (id, org_id, day, start_min, end_min, title, block_type, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 3, 600, 660, 'Owner Thursday', 'admin', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 3, 600, 660, 'Coach Thursday', 'admin', '00000000-0000-0000-0000-0000000000a2'),
  ('20000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 3, 600, 660, 'Org B Thursday', 'admin', '00000000-0000-0000-0000-0000000000b1');

create function pg_temp.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ── 1. A one-day move leaves the template alone ───────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min, created_by)
  values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-23', 840, 900, '00000000-0000-0000-0000-0000000000a1');
  assert (select (day, start_min, end_min) = (3, 600, 660) from schedule_blocks where id = '20000000-0000-0000-0000-000000000001'),
    '1: the template keeps Thursday 10:00, so next Thursday is unchanged';
  assert (select count(*) from schedule_block_overrides where on_date = '2026-10-29') = 0, '1: next Thursday has no override';
  -- Moving it again on the same date is an update of the one row.
  insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
  values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-22', 700, 760)
  on conflict (block_id, on_date) do update set new_date = excluded.new_date, start_min = excluded.start_min, end_min = excluded.end_min;
  assert (select count(*) from schedule_block_overrides) = 1, '1: one override per block per date';
  assert (select start_min from schedule_block_overrides) = 700, '1: the second move replaced the first';
end $$;
rollback;

-- ── 2. Shape rules ────────────────────────────────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin
    insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
    values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-26', 600, 660);
    assert false, '2: a move into next week must be refused';
  exception when check_violation then null; end;
  begin
    insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
    values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-21', '2026-10-21', 600, 660);
    assert false, '2: the occurrence date must be the block''s weekday';
  exception when check_violation then null; end;
  begin
    insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
    values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-22', 660, 600);
    assert false, '2: end after start';
  exception when check_violation then null; end;
  -- Sunday stays in the same week as Monday.
  insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
  values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-25', 600, 660);
  -- Busy holds and anchors.
  insert into schedule_blocks (org_id, day, start_min, end_min, title, block_type, recur, anchor_week, created_by)
  values ('a0000000-0000-0000-0000-00000000000a', 1, 600, 660, 'Busy', 'hold', 'biweekly', '2026-10-19', '00000000-0000-0000-0000-0000000000a1');
  begin
    update schedule_blocks set anchor_week = '2026-10-21' where title = 'Busy';
    assert false, '2: an anchor must be a Monday';
  exception when check_violation then null; end;
  insert into schedule_settings (profile_id, org_id, default_block_type)
  values ('00000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'hold');
end $$;
rollback;

-- ── 3. Only the block's own staff reach its overrides ─────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-22', 700, 760),
       ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000002', '2026-10-22', '2026-10-22', 700, 760);
do $$ begin assert (select count(*) from schedule_block_overrides) = 2, '3: owner sees the org''s overrides'; end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  assert (select count(*) from schedule_block_overrides) = 1, '3: coach sees only their own block''s override';
  begin
    insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
    values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-29', '2026-10-29', 700, 760);
    assert false, '3: coach cannot move the owner''s block';
  exception when insufficient_privilege then null; end;
  update schedule_block_overrides set start_min = 720 where block_id = '20000000-0000-0000-0000-000000000001';
  assert (select count(*) from schedule_block_overrides where start_min = 720) = 0, '3: coach update of owner''s override touches nothing';
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from schedule_block_overrides) = 0, '3: another org sees none';
  begin
    insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
    values ('b0000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', '2026-10-29', '2026-10-29', 700, 760);
    assert false, '3: another org cannot point at org A''s block';
  exception when insufficient_privilege or check_violation then null; end;
end $$;
reset role;

do $$
declare u uuid;
begin
  foreach u in array array['00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
                           '00000000-0000-0000-0000-0000000000e1']::uuid[]
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    assert (select count(*) from schedule_block_overrides) = 0, format('3: %s reads no overrides', u);
    begin
      insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
      values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-29', '2026-10-29', 700, 760);
      assert false, format('3: %s cannot write an override', u);
    exception when insufficient_privilege then null; end;
    execute 'reset role';
  end loop;
end $$;
rollback;

-- ── 4. Deleting a block removes its overrides ─────────────────
begin;
insert into schedule_block_overrides (org_id, block_id, on_date, new_date, start_min, end_min)
values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-22', '2026-10-22', 700, 760);
delete from schedule_blocks where id = '20000000-0000-0000-0000-000000000001';
do $$ begin assert (select count(*) from schedule_block_overrides) = 0, '4: override follows its block'; end $$;
rollback;

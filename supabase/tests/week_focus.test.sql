-- My three and This Week's Five (migration 20261022000002_week_focus):
-- caps hold, a set replaces in one go, picks point only at visible
-- tasks, and nobody else reads anyone's picks.

\set ON_ERROR_STOP 1
\o /dev/null

insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'client@test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'advisor@test', '{}');
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'coach'  where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'client' where id = '00000000-0000-0000-0000-0000000000a3';
update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000b1';
update profiles set role = 'advisor' where id = '00000000-0000-0000-0000-0000000000e1';
insert into advisor_relationships (advisor_id, org_id) values ('00000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a');

insert into business_tasks (id, org_id, title, created_by, assigned_to) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'T1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'T2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'T3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 'T4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-00000000000a', 'T5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-00000000000a', 'T6', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-00000000000a', 'Coach task', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2'),
  ('10000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Org B task', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1');

create function pg_temp.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ── 1. Set, replace, and the caps ─────────────────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]);
  assert (select count(*) from day_focus) = 2, '1: two picked';
  perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[]);
  assert (select array_agg(task_id order by position) from day_focus where on_date = '2026-10-22')
       = array['10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[], '1: replaced, in order';
  begin
    perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004']::uuid[]);
    assert false, '1: a fourth must be refused';
  exception when invalid_parameter_value then null; end;
  assert (select count(*) from day_focus where on_date = '2026-10-22') = 3, '1: refused set left the three as they were';
  begin
    insert into day_focus (org_id, on_date, task_id, position) values ('a0000000-0000-0000-0000-00000000000a', '2026-10-22', '10000000-0000-0000-0000-000000000004', 4);
    assert false, '1: position 4 must fail the schema';
  exception when check_violation then null; end;
  begin
    perform set_day_focus('2026-10-23', array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001']::uuid[]);
    assert false, '1: duplicates refused';
  exception when invalid_parameter_value then null; end;

  perform set_week_five('2026-10-19', array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005']::uuid[]);
  assert (select count(*) from week_plans) = 5, '1: five set';
  begin
    perform set_week_five('2026-10-19', array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006']::uuid[]);
    assert false, '1: a sixth must be refused';
  exception when invalid_parameter_value then null; end;
  begin
    perform set_week_five('2026-10-21', array['10000000-0000-0000-0000-000000000001']::uuid[]);
    assert false, '1: a week must start on Monday';
  exception when check_violation then null; end;
  perform set_week_five('2026-10-19', '{}'::uuid[]);
  assert (select count(*) from week_plans) = 0, '1: an empty set clears the week';
end $$;
rollback;

-- ── 2. Picks point only at tasks the person can see ───────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-0000000000c1']::uuid[]);
  assert (select count(*) from day_focus) = 1, '2: coach can pick their own task';
  begin
    perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000001']::uuid[]);
    assert false, '2: coach cannot point at the owner''s task';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin
    perform set_week_five('2026-10-19', array['10000000-0000-0000-0000-0000000000b1']::uuid[]);
    assert false, '2: owner cannot point at another org''s task';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

-- ── 3. Nobody reads anyone else's picks ───────────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000001']::uuid[]);
select set_week_five('2026-10-19', array['10000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
do $$
declare u uuid;
begin
  foreach u in array array['00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
                           '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1']::uuid[]
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    assert (select count(*) from day_focus) + (select count(*) from week_plans) = 0, format('3: %s reads no picks', u);
    execute 'reset role';
  end loop;
end $$;
-- A client or advisor cannot write picks either.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  begin
    perform set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000001']::uuid[]);
    assert false, '3: client cannot set picks';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  begin
    perform set_week_five('2026-10-19', array['10000000-0000-0000-0000-000000000001']::uuid[]);
    assert false, '3: advisor cannot set picks';
  exception when insufficient_privilege or not_null_violation then null; end;
end $$;
rollback;

-- ── 4. Deleting a task removes it from the picks ──────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_day_focus('2026-10-22', array['10000000-0000-0000-0000-000000000006']::uuid[]);
reset role;
delete from business_tasks where id = '10000000-0000-0000-0000-000000000006';
do $$ begin assert (select count(*) from day_focus) = 0, '4: pick follows the task'; end $$;
rollback;

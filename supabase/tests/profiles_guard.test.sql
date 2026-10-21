-- profiles: role and org_id cannot be self-assigned
-- (migration 20261021000001_profiles_guard_privileged).
-- Each case runs as the 'authenticated' database role with the JWT
-- claims PostgREST would set, inside a transaction that rolls back.

\set ON_ERROR_STOP 1

-- Fixtures, as the superuser (migrations path, so the guard passes).
insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test', '{"first_name":"Owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach-a@test', '{"first_name":"Coach"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'client-a@test', '{"first_name":"Client"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test', '{"first_name":"OwnerB"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'new@test', '{"first_name":"New"}');

update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'
  where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'coach'
  where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'client'
  where id = '00000000-0000-0000-0000-0000000000a3';
update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b', role = 'owner'
  where id = '00000000-0000-0000-0000-0000000000b1';
-- ...c1 stays as the signup trigger left it: role client, no org.

do $$ begin
  assert (select count(*) from profiles) = 5, 'fixture: five profiles';
end $$;

-- Runs one statement as a signed-in user and reports whether the
-- guard refused it. RLS-hidden rows simply update nothing.
create function pg_temp.try_as(uid uuid, stmt text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute stmt;
  exception when insufficient_privilege then
    execute 'reset role';
    return 'refused';
  end;
  execute 'reset role';
  return 'ran';
end;
$$;

-- 1. A client cannot make themselves owner.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a3',
    $s$update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a3'$s$) = 'refused',
    '1: client self-promotion must be refused';
  assert (select role from profiles where id = '00000000-0000-0000-0000-0000000000a3') = 'client',
    '1: client role unchanged';
end $$;
rollback;

-- 2. A brand-new signup (no org) cannot attach themselves to an org.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000c1',
    $s$update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'
       where id = '00000000-0000-0000-0000-0000000000c1'$s$) = 'refused',
    '2: orphan self-attach must be refused';
  assert (select org_id from profiles where id = '00000000-0000-0000-0000-0000000000c1') is null,
    '2: orphan org unchanged';
end $$;
rollback;

-- 3. A coach cannot move themselves to another org.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a2',
    $s$update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b'
       where id = '00000000-0000-0000-0000-0000000000a2'$s$) = 'refused',
    '3: coach cross-org self-move must be refused';
end $$;
rollback;

-- 4. Ordinary self-edits still work.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a3',
    $s$update profiles set first_name = 'Renamed', phone = '555' where id = '00000000-0000-0000-0000-0000000000a3'$s$) = 'ran',
    '4: self name edit must run';
  assert (select first_name from profiles where id = '00000000-0000-0000-0000-0000000000a3') = 'Renamed',
    '4: name saved';
end $$;
rollback;

-- 5. The owner can change a member's role inside their own org.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a1',
    $s$update profiles set role = 'coach' where id = '00000000-0000-0000-0000-0000000000a3'$s$) = 'ran',
    '5: owner role change in org must run';
  assert (select role from profiles where id = '00000000-0000-0000-0000-0000000000a3') = 'coach',
    '5: role saved';
end $$;
rollback;

-- 6. The owner cannot push a member out to another org.
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a1',
    $s$update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b'
       where id = '00000000-0000-0000-0000-0000000000a2'$s$) = 'refused',
    '6: owner cross-org move must be refused';
end $$;
rollback;

-- 7. The owner cannot change their own role (no accidental lock-out).
begin;
do $$ begin
  assert pg_temp.try_as('00000000-0000-0000-0000-0000000000a1',
    $s$update profiles set role = 'coach' where id = '00000000-0000-0000-0000-0000000000a1'$s$) = 'refused',
    '7: owner self role change must be refused';
end $$;
rollback;

-- 8. Another org's owner reaches nothing in org A (RLS hides the row).
begin;
do $$ begin
  perform pg_temp.try_as('00000000-0000-0000-0000-0000000000b1',
    $s$update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a3'$s$);
  assert (select role from profiles where id = '00000000-0000-0000-0000-0000000000a3') = 'client',
    '8: other org owner changed nothing';
end $$;
rollback;

-- 9. The service role (server admin client) keeps its paths: invite a
--    coach, attach a client or parent login.
begin;
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'parent'
    where id = '00000000-0000-0000-0000-0000000000c1';
  execute 'reset role';
  assert (select role from profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'parent',
    '9: service role attach must run';
end $$;
rollback;

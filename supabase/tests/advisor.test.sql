-- The advisor role reaches only what migration
-- 20261021000003_advisor_foundation grants, and nobody else reaches
-- the advisor's private work. Each case runs as the 'authenticated'
-- database role with PostgREST-style JWT claims.

\set ON_ERROR_STOP 1
\o /dev/null

-- ── Fixtures (superuser) ──────────────────────────────────────
insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test', '{"first_name":"OwnerA"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach-a@test', '{"first_name":"CoachA"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'client-a@test', '{"first_name":"ClientA"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'parent-a@test', '{"first_name":"ParentA"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test', '{"first_name":"OwnerB"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'advisor@test', '{"first_name":"Adv"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'other-advisor@test', '{"first_name":"Other"}');

update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'coach'  where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'client' where id = '00000000-0000-0000-0000-0000000000a3';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'parent' where id = '00000000-0000-0000-0000-0000000000a4';
update profiles set org_id = 'b0000000-0000-0000-0000-00000000000b', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000b1';
-- Advisors carry no org; access comes only from a relationship.
update profiles set role = 'advisor' where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');

insert into advisor_relationships (advisor_id, org_id, advisor_name, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'Adv', '00000000-0000-0000-0000-0000000000a1');

-- Sensitive rows in org A, so "reads zero" means something.
insert into clients (id, org_id, user_id, first_name, last_name) values
  ('c0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'Sample', 'Client');
insert into check_ins (org_id, client_id) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c1');
insert into measurements (org_id, client_id) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c1');
insert into training_plans (org_id, client_id, title) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c1', 'Plan');
insert into programs (id, org_id, name) values ('d0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-00000000000a', 'Kids program');
insert into participants (id, org_id, program_id, first_name, last_name, parent_user_id) values
  ('d0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-0000000000d1', 'Kid', 'One', '00000000-0000-0000-0000-0000000000a4');
insert into participant_medical (org_id, participant_id) values ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-0000000000f1');
insert into guardians (org_id, first_name, last_name) values ('a0000000-0000-0000-0000-00000000000a', 'Parent', 'One');
insert into forms (org_id, kind, title) values ('a0000000-0000-0000-0000-00000000000a', 'waiver', 'Waiver');
insert into food_items (org_id, source, name) values ('a0000000-0000-0000-0000-00000000000a', 'manual', 'Oats');
insert into program_badges (org_id, name) values ('a0000000-0000-0000-0000-00000000000a', 'Badge');
insert into message_threads (id, org_id, coach_id, client_id) values
  ('e0000000-0000-0000-0000-0000000000e9', 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000c1');
insert into messages (org_id, thread_id, sender_id, sender_role, content) values
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Private note');
insert into customers (id, org_id, name) values ('f0000000-0000-0000-0000-0000000000f2', 'a0000000-0000-0000-0000-00000000000a', 'Customer');
insert into leads (id, org_id, name) values ('f0000000-0000-0000-0000-0000000000f3', 'a0000000-0000-0000-0000-00000000000a', 'Lead');
insert into revenue_events (org_id, amount_cents) values ('a0000000-0000-0000-0000-00000000000a', 5000);
insert into lead_inquiries (org_id, name, email) values ('a0000000-0000-0000-0000-00000000000a', 'Inquiry', 'i@test');
insert into popup_guests (org_id, full_name, email) values ('a0000000-0000-0000-0000-00000000000a', 'Guest', 'g@test');
insert into schedule_blocks (org_id, day, start_min, end_min, title) values ('a0000000-0000-0000-0000-00000000000a', 0, 600, 660, 'Client 1:1');
insert into sessions (org_id, client_id, title, start_at) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c1', 'Session', now());

-- Owner tasks in org A: plain, client-linked, kids-linked, shared plain,
-- shared client-linked. And one in org B, shared.
insert into business_tasks (id, org_id, title, description, created_by, client_id, program_id, shared_with_advisor) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Plain owner task', 'notes', '00000000-0000-0000-0000-0000000000a1', null, null, false),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'Call Sample Client about knee', 'medical detail', '00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-0000000000c1', null, true),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'Kid One allergy form', 'youth detail', '00000000-0000-0000-0000-0000000000a1', null, 'd0000000-0000-0000-0000-0000000000d1', true),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 'Shared business task', 'ok to see', '00000000-0000-0000-0000-0000000000a1', null, null, true),
  ('10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000b', 'Org B task', null, '00000000-0000-0000-0000-0000000000b1', null, null, true);
insert into task_comments (org_id, task_id, content, created_by) values
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'comment', '00000000-0000-0000-0000-0000000000a1');
insert into advisor_shares (org_id, key, enabled) values
  ('b0000000-0000-0000-0000-00000000000b', 'tasks', true);

-- Signs in for the rest of the transaction.
create function pg_temp.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ── 1. The advisor reads nothing in any existing table ────────
-- Every public table except the advisor's own and their own profile
-- returns zero rows, sensitive data seeded above included.
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$
declare t text; n bigint; leaks text := '';
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('advisor_relationships', 'advisor_shares', 'advisor_items', 'profiles', 'posts')
  loop
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      n := 0;  -- sealed outright (no grant at all): stronger than zero rows
    end;
    if n > 0 then leaks := leaks || format(' %s=%s', t, n); end if;
  end loop;
  assert leaks = '', '1: advisor reads rows in:' || leaks;
  assert (select count(*) from profiles) = 1, '1: advisor reads only their own profile';
end $$;
rollback;

-- ── 2. The advisor cannot write to existing tables ────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  begin
    insert into business_tasks (org_id, title) values ('a0000000-0000-0000-0000-00000000000a', 'Sneaky');
    assert false, '2: direct task insert must fail';
  exception when insufficient_privilege then null; end;
  update business_tasks set title = 'x';
  update clients set first_name = 'x';
  delete from messages;
end $$;
reset role;
do $$ begin
  assert (select count(*) from business_tasks where title in ('x', 'Sneaky')) = 0, '2: no task changed';
  assert (select count(*) from clients where first_name = 'x') = 0, '2: no client changed';
  assert (select count(*) from messages) = 1, '2: no message deleted';
end $$;
rollback;

-- ── 3. advisor_tasks: assigned or shared only, masked links ───
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  -- tasks share is off: nothing yet
  assert (select count(*) from advisor_tasks()) = 0, '3: nothing before sharing';
end $$;
reset role;
insert into advisor_shares (org_id, key, enabled) values ('a0000000-0000-0000-0000-00000000000a', 'tasks', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from advisor_tasks()) = 3, '3: three shared tasks in org A, none from org B, unshared hidden';
  assert not exists (select 1 from advisor_tasks() where id = '10000000-0000-0000-0000-000000000001'), '3: unshared task hidden';
  assert not exists (select 1 from advisor_tasks() where org_id = 'b0000000-0000-0000-0000-00000000000b'), '3: other org hidden';
  assert (select title from advisor_tasks() where id = '10000000-0000-0000-0000-000000000004') = 'Shared business task', '3: plain shared title visible';
  assert (select masked and title = 'A client task · details not shared with you' and description is null
          from advisor_tasks() where id = '10000000-0000-0000-0000-000000000002'), '3: client task masked';
  assert (select masked and description is null
          from advisor_tasks() where id = '10000000-0000-0000-0000-000000000003'), '3: kids task masked';
  assert not exists (select 1 from advisor_tasks() where title ilike '%knee%' or title ilike '%allergy%'
                     or description ilike '%medical%' or description ilike '%youth%'), '3: no sensitive text';
end $$;
rollback;

-- ── 4. Assign and suggest: one task per request, retry-safe ───
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$
declare a uuid; b uuid; s uuid;
begin
  a := advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'Draft the fall pricing page', null, null, 'assignment', '20000000-0000-0000-0000-000000000001');
  b := advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'Draft the fall pricing page', null, null, 'assignment', '20000000-0000-0000-0000-000000000001');
  assert a = b, '4: a retry returns the same task';
  s := advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'Try a referral card', null, null, 'suggestion', '20000000-0000-0000-0000-000000000002');
  assert (select count(*) from advisor_tasks() where from_me) = 2, '4: advisor sees exactly their two';
end $$;
reset role;
do $$ begin
  assert (select count(*) from business_tasks where dedupe_key = 'advisor:20000000-0000-0000-0000-000000000001') = 1, '4: one row per request';
  assert (select assigned_to from business_tasks where dedupe_key = 'advisor:20000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a1', '4: assigned to the owner';
  assert (select kind from business_tasks where dedupe_key = 'advisor:20000000-0000-0000-0000-000000000002') = 'suggestion', '4: suggestion kept as suggestion';
end $$;
-- The owner completes the assignment; the advisor sees one status change.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update business_tasks set status = 'done', completed_at = now() where dedupe_key = 'advisor:20000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from advisor_tasks() where from_me and status = 'done') = 1, '4: advisor sees it done';
  assert (select count(*) from advisor_tasks() where from_me) = 2, '4: still two, no duplicate';
end $$;
rollback;

-- ── 5. Assign is refused without a relationship, or for another org ─
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  begin
    perform advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'x', null, null, 'assignment', gen_random_uuid());
    assert false, '5: unrelated advisor must be refused';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from advisor_tasks()) = 0, '5: unrelated advisor reads nothing';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  begin
    perform advisor_assign_task('b0000000-0000-0000-0000-00000000000b', 'x', null, null, 'assignment', gen_random_uuid());
    assert false, '5: other org must be refused';
  exception when insufficient_privilege then null; end;
  begin
    perform advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'x', null, null, 'task', gen_random_uuid());
    assert false, '5: kind must be assignment or suggestion';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- Owner and coach cannot call it either.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin
    perform advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'x', null, null, 'assignment', gen_random_uuid());
    assert false, '5: owner must be refused';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from advisor_tasks()) = 0, '5: advisor_tasks is empty for the owner';
end $$;
rollback;

-- ── 6. Advisor items: private stays private ───────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into advisor_items (org_id, kind, title, vis) values
  ('a0000000-0000-0000-0000-00000000000a', 'todo', 'My private note', 'private'),
  ('a0000000-0000-0000-0000-00000000000a', 'deliverable', 'Pricing one-pager', 'shared');
do $$ begin
  begin
    insert into advisor_items (org_id, title) values ('b0000000-0000-0000-0000-00000000000b', 'Wrong org');
    assert false, '6: item in an unrelated org must fail';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from advisor_items) = 2, '6: advisor sees their two';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from advisor_items) = 1, '6: owner sees only the shared item';
  assert not exists (select 1 from advisor_items where vis = 'private'), '6: owner never sees private';
  update advisor_items set title = 'owner edit';
  delete from advisor_items;
end $$;
reset role;
do $$ begin
  assert (select count(*) from advisor_items where title = 'owner edit') = 0, '6: owner cannot edit advisor items';
  assert (select count(*) from advisor_items) = 2, '6: owner cannot delete advisor items';
end $$;
-- Coach, client, parent, other org owner, other advisor: nothing.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert (select count(*) from advisor_items) + (select count(*) from advisor_relationships) + (select count(*) from advisor_shares) = 0, '6: coach reads no advisor rows'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin assert (select count(*) from advisor_items) + (select count(*) from advisor_relationships) + (select count(*) from advisor_shares) = 0, '6: client reads no advisor rows'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin assert (select count(*) from advisor_items) + (select count(*) from advisor_relationships) + (select count(*) from advisor_shares) = 0, '6: parent reads no advisor rows'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
do $$ begin assert (select count(*) from advisor_items) + (select count(*) from advisor_relationships) = 0, '6: other org owner reads no advisor rows'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin assert (select count(*) from advisor_items) + (select count(*) from advisor_relationships) + (select count(*) from advisor_shares) = 0, '6: other advisor reads nothing'; end $$;
rollback;

-- ── 7. Removing access ends it ────────────────────────────────
begin;
insert into advisor_shares (org_id, key, enabled) values ('a0000000-0000-0000-0000-00000000000a', 'tasks', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update advisor_relationships set active = false where advisor_id = '00000000-0000-0000-0000-0000000000e1';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from advisor_tasks()) = 0, '7: no tasks after removal';
  assert (select count(*) from advisor_shares) = 0, '7: no shares after removal';
  assert (select count(*) from advisor_orgs()) = 0, '7: no orgs after removal';
  begin
    perform advisor_assign_task('a0000000-0000-0000-0000-00000000000a', 'x', null, null, 'assignment', gen_random_uuid());
    assert false, '7: assign refused after removal';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

-- ── 8. The advisor cannot grant themselves anything ───────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  begin
    insert into advisor_relationships (advisor_id, org_id) values ('00000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a');
    assert false, '8: self-granted relationship must fail';
  exception when insufficient_privilege then null; end;
  begin
    insert into advisor_shares (org_id, key, enabled) values ('a0000000-0000-0000-0000-00000000000a', 'tasks', true);
    assert false, '8: self-granted share must fail';
  exception when insufficient_privilege then null; end;
  begin
    update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a' where id = '00000000-0000-0000-0000-0000000000e2';
    assert false, '8: joining an org must fail';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

-- ── 9. Owner sees the org's relationships and advisor orgs list ─
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from advisor_orgs()) = 1, '9: advisor sees their org';
  assert (select owner_first_name from advisor_orgs()) = 'OwnerA', '9: with the owner first name';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from advisor_relationships) = 1, '9: owner sees their advisor';
end $$;
rollback;

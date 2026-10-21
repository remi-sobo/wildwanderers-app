-- Advisor calls (migration 20261022000001_advisor_calls): transcripts
-- and proposals are the advisor's alone; sending accepted items makes
-- work exactly once; expiry hides then deletes a call.

\set ON_ERROR_STOP 1
\o /dev/null

insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test', '{"first_name":"OwnerA"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'client@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'parent@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'advisor@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'other@test', '{}');
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'owner'  where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'coach'  where id = '00000000-0000-0000-0000-0000000000a2';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'client' where id = '00000000-0000-0000-0000-0000000000a3';
update profiles set org_id = 'a0000000-0000-0000-0000-00000000000a', role = 'parent' where id = '00000000-0000-0000-0000-0000000000a4';
update profiles set role = 'advisor' where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
insert into advisor_relationships (advisor_id, org_id, advisor_name) values
  ('00000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'Adv');
-- An existing owner task a proposal can match.
insert into business_tasks (id, org_id, title, created_by) values
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a', 'Send the pop-up waiver', '00000000-0000-0000-0000-0000000000a1');

create function pg_temp.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- The advisor records a call and its reviewed items. Committed, so the
-- later cases share it.
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into coaching_sessions (id, org_id, title, transcript) values
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Weekly call',
   'Private transcript: we talked about pricing, and a personal matter.');
insert into session_items (session_id, org_id, item_key, section, text, owner, state, send_as, keep_private, match_task_id, flag) values
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-assign',   'owner',   'Draft the fall price sheet', 'owner',   'accepted', 'assignment', false, null, null),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-suggest',  'owner',   'Try a referral card',        'owner',   'accepted', 'suggestion', false, null, 'idea'),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-unclear',  'owner',   'Book the park permit',       'unclear', 'accepted', 'assignment', false, null, 'needs_clarification'),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-proposed', 'owner',   'Not reviewed yet',           'owner',   'proposed', 'assignment', false, null, null),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-mine',     'advisor', 'Send notes on pricing',      'advisor', 'accepted', null,         false, null, null),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-private',  'owner',   'Think about hiring',         'owner',   'accepted', 'assignment', true,  null, null),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-decided',  'decided', 'Pop-ups stay on Saturdays',  'owner',   'accepted', null,         false, null, null),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-match',    'owner',   'Send the pop-up waiver',     'owner',   'accepted', 'assignment', false, '10000000-0000-0000-0000-000000000009', 'already_in_app'),
  ('c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'k-removed',  'owner',   'Dropped idea',               'owner',   'removed',  'assignment', false, null, null);
commit;

-- ── 1. Nobody else reads the call or its items ────────────────
do $$
declare u uuid;
begin
  foreach u in array array[
    '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000e2']::uuid[]
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    assert (select count(*) from coaching_sessions) = 0, format('1: %s reads no calls', u);
    assert (select count(*) from session_items) = 0, format('1: %s reads no call items', u);
    execute 'reset role';
  end loop;
end $$;

-- ── 2. Only the advisor writes; others cannot send or delete ──
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  delete from coaching_sessions;
  begin
    perform advisor_send_call('c1000000-0000-0000-0000-000000000001');
    assert false, '2: owner cannot send';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  begin
    perform advisor_send_call('c1000000-0000-0000-0000-000000000001');
    assert false, '2: another advisor cannot send';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin assert (select count(*) from coaching_sessions) = 1, '2: the call is still there'; end $$;
rollback;

-- ── 3. Send: the right things, once ───────────────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$
declare r record;
begin
  select * into r from advisor_send_call('c1000000-0000-0000-0000-000000000001');
  assert r.sent_tasks = 2, format('3: two tasks to the owner, got %s', r.sent_tasks);
  assert r.saved_todos = 2, format('3: two private to-dos, got %s', r.saved_todos);
  assert r.kept_on_record = 2, format('3: decision and match on record, got %s', r.kept_on_record);
  assert r.held_back = 1, format('3: the unclear item held back, got %s', r.held_back);
  -- Again, as a retry would: nothing new.
  select * into r from advisor_send_call('c1000000-0000-0000-0000-000000000001');
  assert r.sent_tasks = 0 and r.saved_todos = 0 and r.kept_on_record = 0 and r.held_back = 1, '3: a re-send creates nothing';
  assert (select status from coaching_sessions) = 'extracted' or (select status from coaching_sessions) = 'new', '3: not marked sent while something is held';
  assert (select state from session_items where item_key = 'k-proposed') = 'proposed', '3: unreviewed item untouched';
  assert (select state from session_items where item_key = 'k-removed') = 'removed', '3: removed item untouched';
  assert (select sent_task_id from session_items where item_key = 'k-match') = '10000000-0000-0000-0000-000000000009', '3: match linked, not duplicated';
  assert (select count(*) from advisor_items where vis = 'private') = 2, '3: two private to-dos for the advisor';
end $$;
reset role;
do $$ begin
  assert (select count(*) from business_tasks where source_type = 'advisor_call') = 2, '3: exactly two tasks made';
  assert (select count(*) from business_tasks where title = 'Send the pop-up waiver') = 1, '3: no duplicate of the matched task';
  assert not exists (select 1 from business_tasks where title in ('Book the park permit', 'Not reviewed yet', 'Think about hiring', 'Dropped idea')), '3: held, unreviewed, private and removed never reach the owner';
end $$;
-- The owner sees the two, as plain tasks, with no transcript attached.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert (select count(*) from business_tasks where source_type = 'advisor_call') = 2, '3: owner sees the two';
  assert (select count(*) from business_tasks where source_type = 'advisor_call' and description is not null) = 0, '3: no transcript text on the tasks';
  assert (select kind from business_tasks where title = 'Try a referral card') = 'suggestion', '3: suggestion stays a suggestion';
  assert (select count(*) from advisor_items) = 0, '3: owner never sees the private to-dos';
end $$;
reset role;
-- Clarify the unclear item, send again: it goes, the call is done.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
update session_items set owner = 'owner' where item_key = 'k-unclear';
do $$
declare r record;
begin
  select * into r from advisor_send_call('c1000000-0000-0000-0000-000000000001');
  assert r.sent_tasks = 1 and r.held_back = 0, '3: the clarified item sends';
  assert (select status from coaching_sessions) = 'sent', '3: call marked sent';
end $$;
rollback;

-- ── 4. Expiry hides, then purge deletes; tasks survive ────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select * from advisor_send_call('c1000000-0000-0000-0000-000000000001');
reset role;
update coaching_sessions set expires_at = now() - interval '1 minute';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from coaching_sessions) = 0, '4: an expired call is unreadable';
  assert (select count(*) from session_items) = 0, '4: and so are its items';
  begin
    perform advisor_send_call('c1000000-0000-0000-0000-000000000001');
    assert false, '4: an expired call cannot be sent';
  exception when insufficient_privilege then null; end;
  assert purge_expired_calls() = 1, '4: purge deletes it';
end $$;
reset role;
do $$ begin
  assert (select count(*) from coaching_sessions) = 0, '4: gone';
  assert (select count(*) from session_items) = 0, '4: items gone';
  assert (select count(*) from business_tasks where source_type = 'advisor_call') = 2, '4: sent tasks remain';
  assert (select count(*) from business_tasks where source_session_item_id is not null) = 0, '4: their link is cleared';
end $$;
rollback;

-- ── 5. The advisor can delete their own call ──────────────────
begin;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
delete from coaching_sessions where id = 'c1000000-0000-0000-0000-000000000001';
reset role;
do $$ begin
  assert (select count(*) from coaching_sessions) = 0, '5: advisor deleted the call';
  assert (select count(*) from session_items) = 0, '5: its items went with it';
end $$;
rollback;

-- ── 6. Removing access hides the calls ────────────────────────
begin;
update advisor_relationships set active = false;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  assert (select count(*) from coaching_sessions) = 0, '6: no calls after access is removed';
end $$;
rollback;

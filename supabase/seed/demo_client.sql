-- ============================================================
-- Wild Wanderers — Demo client showcase data
--
-- demo.client@wildwanderers.life is a clearly-labeled demo account so
-- Gabe can walk the client side and see a fully built-out, mid-plan
-- client. It is the ONE place we populate sample data. Real client
-- records are never fabricated (see CLAUDE.md: no fabricated content).
--
-- STANDING PRACTICE: each ring, extend this file to fill the demo
-- client's new surfaces with that ring's functionality (training plan
-- and workouts at Ring 1, measurements and habits and the wellness
-- score at Ring 2, and so on). Keep every addition obviously a demo.
--
-- Idempotent. Safe to re-run.
-- ============================================================

do $$
declare
  ww        uuid;
  demo_user uuid;
  gabe      uuid;
  grp       uuid;
begin
  select id into ww        from public.organizations where slug = 'wild-wanderers-fitness';
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  select id into gabe      from auth.users where email = 'brewha07@gmail.com';

  if demo_user is null then
    raise notice 'demo client account not found; run the account seed first';
    return;
  end if;

  -- Ring 0: flesh out the client profile and record.
  update public.profiles set
    phone = '+1 (555) 0142',
    updated_at = now()
  where id = demo_user;

  update public.clients set
    goal = 'Build a steady trail-running base and drop 15 lbs before fall.',
    date_of_birth = '1989-05-14',
    status = 'active',
    updated_at = now()
  where user_id = demo_user;

  -- Ring 0: a coaching group, coached by Gabe, with the demo client in it.
  select id into grp from public.groups where org_id = ww and name = 'Sunrise Trail Crew';
  if grp is null then
    insert into public.groups (org_id, name, kind, coach_id, is_active)
    values (ww, 'Sunrise Trail Crew', 'fitness_group', gabe, true)
    returning id into grp;
  end if;

  insert into public.group_coaches (org_id, coach_id, group_id)
  select ww, gabe, grp
  where gabe is not null
    and not exists (
      select 1 from public.group_coaches where coach_id = gabe and group_id = grp
    );

  insert into public.client_groups (org_id, client_id, group_id)
  select ww, c.id, grp
  from public.clients c
  where c.user_id = demo_user
    and not exists (
      select 1 from public.client_groups cg where cg.client_id = c.id and cg.group_id = grp
    );

  -- Ring 2+: measurements, habits, wellness score. Added as each ring builds.
end $$;

-- ── Ring 1: an active plan, a session, a conversation, some progress ──
-- Resets the demo client's Ring 1 content and rebuilds a rich, mid-plan
-- showcase. Scoped to the demo client only. Idempotent.
do $$
declare
  ww uuid; demo_user uuid; demo_c uuid; gabe uuid;
  plan uuid; w1 uuid; w2 uuid; thread uuid;
begin
  select id into ww from public.organizations where slug = 'wild-wanderers-fitness';
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  select id into gabe from auth.users where email = 'brewha07@gmail.com';
  select c.id into demo_c from public.clients c where c.user_id = demo_user;
  if demo_c is null then return; end if;

  -- Reset (cascades clear workouts, exercises, completions, and messages).
  delete from public.exercise_completions where client_id = demo_c;
  delete from public.training_plans where client_id = demo_c;
  delete from public.sessions where client_id = demo_c;
  delete from public.message_threads where client_id = demo_c;

  -- Active plan.
  insert into public.training_plans (org_id, client_id, coach_id, title, goal, status, duration_weeks)
  values (ww, demo_c, gabe, 'Foundations — Weeks 1 to 2',
          'Build a base and dial in the main lifts.', 'active', 2)
  returning id into plan;

  -- Workout 1: Lower Body, pulled from the exercise library.
  insert into public.workouts (org_id, plan_id, day_number, week_number, title)
  values (ww, plan, 1, 1, 'Lower Body') returning id into w1;
  insert into public.workout_exercises (org_id, workout_id, library_item_id, kind, title, sets, reps, load, sort_order, is_optional)
  select ww, w1, l.id, l.kind, l.title, l.default_sets, l.default_reps, x.load, x.ord, x.opt
  from (values
    ('Goblet Squat','60 kg',0,false),
    ('Romanian Deadlift','50 kg',1,false),
    ('Walking Lunge','2 x 12 kg',2,false),
    ('Standing Calf Raise',null,3,true)
  ) as x(name, load, ord, opt)
  join public.exercise_library l on l.org_id = ww and l.title = x.name;

  -- Workout 2: Upper Body.
  insert into public.workouts (org_id, plan_id, day_number, week_number, title)
  values (ww, plan, 2, 1, 'Upper Body') returning id into w2;
  insert into public.workout_exercises (org_id, workout_id, library_item_id, kind, title, sets, reps, load, sort_order, is_optional)
  select ww, w2, l.id, l.kind, l.title, l.default_sets, l.default_reps, x.load, x.ord, x.opt
  from (values
    ('Bench Press','40 kg',0,false),
    ('Bent-Over Row','40 kg',1,false),
    ('Overhead Press','25 kg',2,false),
    ('Push-Up',null,3,false)
  ) as x(name, load, ord, opt)
  join public.exercise_library l on l.org_id = ww and l.title = x.name;

  -- Two exercises already done in workout 1 (mid-plan progress).
  insert into public.exercise_completions (org_id, workout_exercise_id, client_id)
  select ww, e.id, demo_c
  from public.workout_exercises e
  where e.workout_id = w1 and e.title in ('Goblet Squat', 'Romanian Deadlift');

  -- Next session.
  insert into public.sessions (org_id, coach_id, client_id, title, kind, start_at, created_by)
  values (ww, gabe, demo_c, 'Check-in with Gabe', 'check_in', now() + interval '3 days', gabe);

  -- A short conversation (the trigger rolls up the last message).
  insert into public.message_threads (org_id, coach_id, client_id) values (ww, gabe, demo_c)
  returning id into thread;
  insert into public.messages (org_id, thread_id, sender_id, sender_role, content, created_at) values
    (ww, thread, gabe, 'owner', 'Welcome aboard. Your Foundations plan is live, start with Lower Body today.', now() - interval '2 days'),
    (ww, thread, demo_user, 'client', 'Amazing, thank you. Just finished it, the squats felt great.', now() - interval '1 day'),
    (ww, thread, gabe, 'owner', 'Love it. Add a little load next session and let me know how it moves.', now() - interval '20 hours');
end $$;

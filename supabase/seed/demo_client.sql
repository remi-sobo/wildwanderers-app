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

  -- Ring 2+: measurements, habits, wellness score. See the Ring 2 block below.
end $$;

-- ── Ring 2: consent, measurements, habits, movement, food, a score ──
-- Rebuilds the demo client's tracking data into a rich, mid-journey
-- showcase: a consented client eight weeks in, weight trending down,
-- habits mostly kept, movement logged, one food entry, and a wellness
-- snapshot for the trend. Scoped to the demo client only. Idempotent.
do $$
declare
  ww uuid; demo_user uuid; demo_c uuid; gabe uuid;
  h_steps uuid; h_water uuid; h_sleep uuid; fi uuid;
  d int;
begin
  select id into ww from public.organizations where slug = 'wild-wanderers-fitness';
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  select id into gabe from auth.users where email = 'brewha07@gmail.com';
  select c.id into demo_c from public.clients c where c.user_id = demo_user;
  if demo_c is null then return; end if;

  -- Reset the demo client's Ring 2 tracking data.
  delete from public.wellness_scores where client_id = demo_c;
  delete from public.food_logs where client_id = demo_c;
  delete from public.habit_logs where client_id = demo_c;
  delete from public.habits where client_id = demo_c;
  delete from public.activity_logs where client_id = demo_c;
  delete from public.measurements where client_id = demo_c;
  delete from public.check_ins where client_id = demo_c;
  delete from public.consents where client_id = demo_c;

  -- Consent, granted at onboarding.
  insert into public.consents (org_id, client_id, granted_by, granted_at)
  values (ww, demo_c, demo_user, now() - interval '56 days');

  -- Weight and waist trending down over eight weekly check-ins.
  insert into public.measurements (org_id, client_id, taken_at, weight_kg, waist_cm, notes)
  select ww, demo_c, now() - (w || ' weeks')::interval,
         86.0 - (7 - w) * 0.6,          -- 86.0 down to ~81.8
         94.0 - (7 - w) * 0.5,          -- 94.0 down to ~90.5
         case when w = 0 then 'Feeling stronger on the trails.' else null end
  from generate_series(7, 0, -1) as w;

  -- Three habits Gabe assigned.
  insert into public.habits (org_id, client_id, title, cadence, target_per_week, created_by)
  values (ww, demo_c, 'Walk 8k steps', 'daily', 7, gabe) returning id into h_steps;
  insert into public.habits (org_id, client_id, title, cadence, target_per_week, created_by)
  values (ww, demo_c, 'Drink 2.5L water', 'daily', 7, gabe) returning id into h_water;
  insert into public.habits (org_id, client_id, title, cadence, target_per_week, created_by)
  values (ww, demo_c, 'Sleep 7+ hours', 'daily', 5, gabe) returning id into h_sleep;

  -- Two weeks of check-offs, kept most days (some honest gaps).
  for d in 0..13 loop
    if d <> 3 then
      insert into public.habit_logs (org_id, client_id, habit_id, logged_on)
      values (ww, demo_c, h_steps, (now() at time zone 'utc')::date - d)
      on conflict do nothing;
    end if;
    if d % 2 = 0 then
      insert into public.habit_logs (org_id, client_id, habit_id, logged_on)
      values (ww, demo_c, h_water, (now() at time zone 'utc')::date - d)
      on conflict do nothing;
    end if;
    if d < 5 then
      insert into public.habit_logs (org_id, client_id, habit_id, logged_on)
      values (ww, demo_c, h_sleep, (now() at time zone 'utc')::date - d)
      on conflict do nothing;
    end if;
  end loop;

  -- Movement this week: a couple of trail runs and a mobility session.
  insert into public.activity_logs (org_id, client_id, logged_at, kind, duration_minutes, estimated_energy_kcal)
  values
    (ww, demo_c, now() - interval '1 day',  'Trail run',   42, 430),
    (ww, demo_c, now() - interval '3 days', 'Trail run',   35, 360),
    (ww, demo_c, now() - interval '4 days', 'Mobility',    20, 90);

  -- One cached food item and a log against it (the cache the API fills).
  insert into public.food_items (org_id, source, external_id, name, brand, serving, calories, protein_g, carb_g, fat_g)
  values (ww, 'usda', 'demo-oats', 'Rolled oats, dry', null, '1/2 cup (40 g)', 150, 5, 27, 3)
  on conflict (org_id, source, external_id) do update set name = excluded.name
  returning id into fi;
  insert into public.food_logs (org_id, client_id, logged_at, meal, food_item_id, description, quantity, calories, protein_g, carb_g, fat_g)
  values (ww, demo_c, now() - interval '6 hours', 'breakfast', fi, 'Rolled oats, dry', 1, 150, 5, 27, 3);

  -- Two check-ins: one Coach has already structured for Gabe, one still open.
  insert into public.check_ins (org_id, client_id, kind, body, structured, status, created_at)
  values (
    ww, demo_c, 'text',
    'Really good week. Both trail runs felt strong and I kept my water up. Sleep slipped on Wednesday and Thursday with a work deadline, so energy dipped, but I still got the sessions in.',
    '{"summary":"Strong training week with consistent movement and hydration; sleep dipped midweek from work but sessions still happened.","mood":"Motivated","wins":["Both trail runs felt strong","Kept water up all week"],"blockers":["Two short-sleep nights from a work deadline"],"focus":"Protect sleep on busy work days"}'::jsonb,
    'reviewed', now() - interval '2 days'
  );
  insert into public.check_ins (org_id, client_id, kind, body, status, created_at)
  values (
    ww, demo_c, 'text',
    'Legs are a little sore from the lunges but in a good way. Thinking about adding a short mobility day, what do you think?',
    'open', now() - interval '4 hours'
  );

  -- The wellness snapshot is written in the final block below, after
  -- Ring 1 seeds the training plan the consistency component reads.
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

-- ── Ring 2 wellness snapshot (runs last, after the plan exists) ──
-- One transparent snapshot for the demo client's Progress trend line.
-- compute_wellness_score guards on the caller, so borrow the demo
-- client's identity for this one call inside the seed transaction.
do $$
declare
  demo_user uuid; demo_c uuid;
begin
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  select c.id into demo_c from public.clients c where c.user_id = demo_user;
  if demo_c is null then return; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', demo_user, 'role', 'authenticated')::text, true);
  perform public.snapshot_wellness_score(demo_c);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Ring 6: a mid-journey longevity profile for the demo client ──
-- A handful of assessment results across pillars, a baseline eight weeks
-- back and a recent retest, most pillars improving. Bands are computed by
-- the trigger. Scoped to the demo client only. Idempotent.
do $$
declare
  ww uuid; demo_user uuid; demo_c uuid; gabe uuid;
begin
  select id into ww from public.organizations where slug = 'wild-wanderers-fitness';
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  select id into gabe from auth.users where email = 'brewha07@gmail.com';
  select c.id into demo_c from public.clients c where c.user_id = demo_user;
  if demo_c is null then return; end if;

  delete from public.assessment_results where client_id = demo_c;

  insert into public.assessment_results
    (org_id, assessment_id, subject, client_id, value, source, recorded_by, taken_on)
  select ww, a.id, 'client', demo_c, v.val, v.src::result_source, gabe,
         (now() - (v.wks || ' weeks')::interval)::date
  from (values
    ('single_leg_balance', 12,   8, 'coach_observed'),
    ('single_leg_balance', 22,   0, 'coach_observed'),
    ('push_ups',           14,   8, 'self_reported'),
    ('push_ups',           23,   0, 'self_reported'),
    ('dead_hang',          25,   8, 'coach_observed'),
    ('dead_hang',          42,   0, 'coach_observed'),
    ('cooper_12min',       1750, 8, 'self_reported'),
    ('cooper_12min',       2050, 0, 'self_reported'),
    ('farmers_carry',      35,   8, 'coach_observed'),
    ('farmers_carry',      55,   0, 'coach_observed'),
    ('resting_hr',         68,   8, 'device_estimate'),
    ('resting_hr',         61,   0, 'device_estimate'),
    ('sleep',              6.5,  8, 'self_reported'),
    ('sleep',              7.5,  0, 'self_reported')
  ) as v(slug, val, wks, src)
  join public.assessments a on a.slug = v.slug and a.org_id = ww;
end $$;

-- ============================================================
-- Ring 10 (Alongside): the demo client walks with the coach.
-- We never author Gabe's voice as real, so the only seed here is the demo
-- client acknowledging the labeled sample note, so the "walking with you"
-- count shows the loop end to end. Idempotent.
-- ============================================================
do $$
declare
  ww uuid; demo_user uuid; sample uuid;
begin
  select id into ww from public.organizations where slug = 'wild-wanderers-fitness';
  select id into demo_user from auth.users where email = 'demo.client@wildwanderers.life';
  if ww is null or demo_user is null then return; end if;
  select id into sample from public.coach_shares
    where org_id = ww and title = 'A sample note' and status = 'published'
    order by created_at limit 1;
  if sample is not null then
    insert into public.coach_share_acks (org_id, share_id, profile_id)
      values (ww, sample, demo_user)
      on conflict (share_id, profile_id) do nothing;
  end if;
end $$;

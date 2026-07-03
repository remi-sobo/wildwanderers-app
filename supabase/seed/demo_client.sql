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

  -- Ring 1+: training plan, workouts, measurements, habits, wellness
  -- score, messages. Added here as each ring builds those tables.
end $$;

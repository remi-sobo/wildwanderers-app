-- ============================================================
-- Team Esface — Milestone catalog seed
--
-- Ten starter milestones spanning training_consistency,
-- plan_completion, evaluation_growth, and program_participation.
-- Four are auto-earned by the activity-completion server action:
-- First Rep, First Day Done, two streak badges, two plan-completion
-- badges. The rest are manually awarded by admin / coach.
--
-- trigger_config keys document the condition the auto-earn
-- evaluator checks (see src/lib/milestones/auto-earn.ts).
--
-- Already applied to the hosted project via MCP; this file is
-- here so local and remote stay in sync. Also pre-earns the three
-- milestones Aaliyah qualifies for under the existing seed plan
-- (Welcome, First Rep, First Day Done).
-- ============================================================

insert into milestone_definitions
  (id, org_id, name, description, category, trigger_type, trigger_config, icon_name, sort_order)
values
  ('bb000000-0000-0000-0000-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Welcome to Esface',
   'Your first evaluation is in the books. Pillar one of the climb.',
   'program_participation', 'manual', null, 'sparkles', 10),

  ('bb000000-0000-0000-0000-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'First Rep',
   'Checked off your very first activity. The rep nobody saw counts.',
   'training_consistency', 'automatic',
   jsonb_build_object('condition', 'first_activity'),
   'check_circle', 20),

  ('bb000000-0000-0000-0000-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'First Day Done',
   'Hit every required activity on a single day. That is the baseline.',
   'training_consistency', 'automatic',
   jsonb_build_object('condition', 'first_full_day'),
   'flame', 30),

  ('bb000000-0000-0000-0000-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Anti-Softness Five',
   'Five days of perfect activity completion. Steel building.',
   'training_consistency', 'automatic',
   jsonb_build_object('condition', 'streak', 'days', 5),
   'shield', 40),

  ('bb000000-0000-0000-0000-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Hot Streak',
   'Seven consecutive days locked in. Nobody outworks you this week.',
   'training_consistency', 'automatic',
   jsonb_build_object('condition', 'streak', 'days', 7),
   'zap', 50),

  ('bb000000-0000-0000-0000-000000000006',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'First Transformation',
   'Closed out your first Transformation Plan from Day 1 to the last whistle.',
   'plan_completion', 'automatic',
   jsonb_build_object('condition', 'plans_completed', 'count', 1),
   'trophy', 60),

  ('bb000000-0000-0000-0000-000000000007',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Two Plans Strong',
   'Two plans in the books. The work compounds.',
   'plan_completion', 'automatic',
   jsonb_build_object('condition', 'plans_completed', 'count', 2),
   'trophy', 70),

  ('bb000000-0000-0000-0000-000000000008',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Hunger Mode',
   'Rated Strong or Elite on Hunger. The fire shows up in every drill.',
   'evaluation_growth', 'manual', null, 'flame', 80),

  ('bb000000-0000-0000-0000-000000000009',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Review Session Done',
   'Sat through the in-person review. You know what you are building.',
   'program_participation', 'manual', null, 'eye', 90),

  ('bb000000-0000-0000-0000-00000000000a',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Pillar Lift',
   'Bumped a pillar rating between evaluations. The work is visible.',
   'evaluation_growth', 'manual', null, 'trending_up', 100)
on conflict (id) do nothing;

insert into athlete_milestones (athlete_id, milestone_definition_id, earned_at)
values
  ('66666666-6666-6666-6666-666666666662',
   'bb000000-0000-0000-0000-000000000001',
   now() - interval '4 days'),
  ('66666666-6666-6666-6666-666666666662',
   'bb000000-0000-0000-0000-000000000002',
   now() - interval '2 days'),
  ('66666666-6666-6666-6666-666666666662',
   'bb000000-0000-0000-0000-000000000003',
   now() - interval '2 days')
on conflict (athlete_id, milestone_definition_id) do nothing;

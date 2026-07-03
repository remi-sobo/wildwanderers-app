-- ============================================================
-- Team Esface — Self-Directed Training milestones
-- Build order step 9
--
-- Two auto-earned milestones that reward athletes who take development
-- into their own hands. Conditions are evaluated by the auto-earn engine
-- (src/lib/milestones/auto-earn.ts):
--   self_directed_completed → Self-Starter
--   self_directed_approved  → Coach Approved
-- Seeded for the demo org, mirroring the milestone catalog seed.
-- ============================================================

insert into milestone_definitions
  (id, org_id, name, description, category, trigger_type, trigger_config, icon_name, sort_order)
values
  ('bb000000-0000-0000-0000-00000000000b',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Self-Starter',
   'Built and completed your first self-directed plan, start to finish. Nobody told you to.',
   'plan_completion', 'automatic',
   jsonb_build_object('condition', 'self_directed_completed'),
   'zap', 110),

  ('bb000000-0000-0000-0000-00000000000c',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Coach Approved',
   'A coach saw the extra work and co-signed your self-directed plan.',
   'program_participation', 'automatic',
   jsonb_build_object('condition', 'self_directed_approved'),
   'check_circle', 120)
on conflict (id) do nothing;

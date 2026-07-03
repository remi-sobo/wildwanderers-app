-- ============================================================
-- Track when each milestone has been viewed.
--
-- The athlete + parent surfaces play a scale-in glow animation the
-- first time a milestone is rendered after earning. `seen_at` is the
-- gate — when null (and earned_at is set) the animation fires, then
-- the client posts a server action that stamps `seen_at = now()`.
--
-- Already applied to the hosted DB via MCP. This file is here so
-- local + remote agree.
-- ============================================================

alter table athlete_milestones
  add column if not exists seen_at timestamptz;

-- Athletes can update their own milestone seen_at.
create policy "athletes_update_own_athlete_milestones"
  on athlete_milestones for update
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  )
  with check (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

-- Parents can update their child's milestone seen_at too — parents
-- often discover the badge first when they open the app.
create policy "parents_update_child_athlete_milestones"
  on athlete_milestones for update
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  )
  with check (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

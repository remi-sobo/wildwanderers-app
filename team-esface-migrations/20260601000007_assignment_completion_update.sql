-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase D · allow athletes to update their own completions
--
-- toggleAssignmentActivity upserts the completion row (INSERT ... ON
-- CONFLICT DO UPDATE) so re-completing or editing a reflection is
-- idempotent. The conflict path performs an UPDATE, which the Phase A
-- policy set didn't grant athletes. Add the missing UPDATE policy,
-- scoped to the athlete's own rows.
-- ============================================================

create policy "athletes_update_own_completions"
  on assignment_completions for update
  using (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  )
  with check (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  );

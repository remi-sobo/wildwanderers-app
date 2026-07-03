-- ============================================================
-- Team Esface — Day 3 RLS Policies
-- Sprint 0, Day 3
--
-- The evaluation flow needs RLS on `review_sessions` so coaches can
-- create one when they finish an evaluation and parents/athletes can
-- see the pending review in their feed.
--
-- Transformation-plan tables are intentionally left for Day 5 when
-- the plan generator ships.
-- ============================================================

-- ============================================================
-- REVIEW_SESSIONS
--
-- A review_session is created when an evaluation is completed and
-- the coach plans to walk the athlete through it in person. Access
-- mirrors evaluations — same shape, but no org column on this table,
-- so we scope through the evaluation's athlete + coach.
-- ============================================================

create policy "admins_full_access_review_sessions"
  on review_sessions for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "coaches_own_review_sessions"
  on review_sessions for all
  using (
    get_user_role() = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    get_user_role() = 'coach'
    and coach_id = auth.uid()
  );

create policy "parents_read_child_review_sessions"
  on review_sessions for select
  using (
    get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_review_sessions"
  on review_sessions for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

-- ============================================================
-- Team Esface — Day 5 RLS Policies (Transformation Plans + Milestones)
-- Sprint 0, Day 5
--
-- Plans tie together: an evaluation triggers a draft plan (admin
-- helper / coach owned), the coach approves, the athlete works
-- through it day by day. Parents read. Admins do everything.
--
-- Tables covered:
--   * transformation_plans
--   * plan_days          (scoped via plan_id -> transformation_plans)
--   * plan_activities    (scoped via plan_day_id -> plan_days)
--   * activity_completions  (athlete writes own; everyone in their
--                            circle reads)
--   * milestone_definitions  (everyone reads; admin writes)
--   * athlete_milestones     (admin/coach/parent/athlete read scoped;
--                             athlete writes own via auto-earn)
-- ============================================================

-- ============================================================
-- TRANSFORMATION_PLANS
-- ============================================================

create policy "admins_full_access_transformation_plans"
  on transformation_plans for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_read_roster_transformation_plans"
  on transformation_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "coaches_write_roster_transformation_plans"
  on transformation_plans for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "coaches_update_roster_transformation_plans"
  on transformation_plans for update
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  )
  with check (
    org_id = get_user_org()
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "parents_read_child_transformation_plans"
  on transformation_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_transformation_plans"
  on transformation_plans for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );

-- ============================================================
-- PLAN_DAYS (scoped via plan_id -> transformation_plans)
-- ============================================================

create policy "scope_plan_days_via_plan"
  on plan_days for all
  using (
    plan_id in (select id from transformation_plans)
  )
  with check (
    plan_id in (select id from transformation_plans)
  );

-- ============================================================
-- PLAN_ACTIVITIES (scoped via plan_day_id -> plan_days)
-- ============================================================

create policy "scope_plan_activities_via_day"
  on plan_activities for all
  using (
    plan_day_id in (select id from plan_days)
  )
  with check (
    plan_day_id in (select id from plan_days)
  );

-- ============================================================
-- ACTIVITY_COMPLETIONS
-- ============================================================
-- Admins everything. Coaches/parents read for their athletes.
-- Athletes mark their own activities complete.

create policy "admins_full_access_activity_completions"
  on activity_completions for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "coaches_read_roster_activity_completions"
  on activity_completions for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "parents_read_child_activity_completions"
  on activity_completions for select
  using (
    get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_activity_completions"
  on activity_completions for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create policy "athletes_write_own_activity_completions"
  on activity_completions for insert
  with check (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create policy "athletes_delete_own_activity_completions"
  on activity_completions for delete
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

-- ============================================================
-- MILESTONE_DEFINITIONS
-- ============================================================
-- Everyone reads the catalog (org-scoped). Admins write.

create policy "members_read_milestone_definitions"
  on milestone_definitions for select
  using (org_id = get_user_org());

create policy "admins_write_milestone_definitions"
  on milestone_definitions for insert
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "admins_update_milestone_definitions"
  on milestone_definitions for update
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- ============================================================
-- ATHLETE_MILESTONES
-- ============================================================

create policy "admins_full_access_athlete_milestones"
  on athlete_milestones for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "coaches_read_roster_athlete_milestones"
  on athlete_milestones for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select a.id
      from athletes a
      where a.current_team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "parents_read_child_athlete_milestones"
  on athlete_milestones for select
  using (
    get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_athlete_milestones"
  on athlete_milestones for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

create policy "athletes_write_own_athlete_milestones"
  on athlete_milestones for insert
  with check (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

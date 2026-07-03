-- ============================================================
-- Team Esface — Day 4 RLS Policies (schedule_events)
-- Sprint 0, Day 4
--
-- Schedule events power the calendar across all four roles. V1 is
-- admin-write-only — coaches, parents, and athletes only read.
--
-- Read scope per role:
--   * admin   — every event in the org
--   * coach   — events for teams they coach, plus org-wide events
--               (team_id null)
--   * parent  — events for their child(ren)'s current team, plus
--               org-wide events
--   * athlete — events for their current team, plus org-wide events
--
-- "Org-wide events" (team_id null) cover things like tryouts,
-- evaluation_window, review_period — visible to the whole program.
-- ============================================================

create policy "admins_full_access_schedule_events"
  on schedule_events for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "coaches_read_team_schedule_events"
  on schedule_events for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and (
      team_id is null
      or team_id in (
        select team_id from coach_teams where coach_id = auth.uid()
      )
    )
  );

create policy "parents_read_child_schedule_events"
  on schedule_events for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and (
      team_id is null
      or team_id in (
        select a.current_team_id
        from athletes a
        join parent_athletes pa on pa.athlete_id = a.id
        where pa.parent_id = auth.uid()
      )
    )
  );

create policy "athletes_read_own_schedule_events"
  on schedule_events for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and (
      team_id is null
      or team_id in (
        select current_team_id from athletes where user_id = auth.uid()
      )
    )
  );

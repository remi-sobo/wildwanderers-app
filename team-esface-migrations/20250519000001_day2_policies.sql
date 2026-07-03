-- ============================================================
-- Team Esface — Day 2 RLS Policies
-- Sprint 0, Day 2
--
-- The Day 1 migration enabled RLS on every table and shipped the
-- canonical four-role policy set on `evaluations`. Day 2 brings the
-- admin backend online (athletes, teams, coaches, knowledge base),
-- so we extend the same pattern to the tables those pages read and
-- write.
--
-- Tables covered here:
--   * profiles                — every signed-in user reads their own
--                               row; admins read everyone in their org;
--                               admins write profiles in their org.
--   * organizations           — members read their own org row.
--   * athletes                — admins all; coaches read athletes on
--                               their team roster; parents read their
--                               linked children; athletes read self.
--   * parent_athletes         — admins all; parent/athlete read own.
--   * teams                   — admins all; coaches read own teams;
--                               parents/athletes read team rows they
--                               belong to.
--   * coach_teams             — admins all; coach reads own rows;
--                               athlete/parent read rows tied to their
--                               team (so they can see who their coach is).
--   * athlete_teams           — admins all; coach reads team roster;
--                               parent/athlete read own rows.
--   * knowledge_base_items    — admins read/write all in org; every
--                               other signed-in user can read active
--                               items in their org (curriculum library).
-- ============================================================

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create policy "members_read_own_org"
  on organizations for select
  using (id = get_user_org());

create policy "admins_update_own_org"
  on organizations for update
  using (id = get_user_org() and get_user_role() = 'admin')
  with check (id = get_user_org() and get_user_role() = 'admin');

-- ============================================================
-- PROFILES
-- ============================================================

create policy "users_read_own_profile"
  on profiles for select
  using (id = auth.uid());

create policy "users_update_own_profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins_read_org_profiles"
  on profiles for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "admins_write_org_profiles"
  on profiles for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

-- A coach needs to see profile rows for the athletes on their roster
-- so we can render names alongside athletes/team rows. Coaches see
-- profiles of athletes on teams they coach, and of parents linked to
-- those athletes.
create policy "coaches_read_roster_profiles"
  on profiles for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and (
      -- Athletes on a team this coach coaches
      id in (
        select a.user_id
        from athletes a
        join coach_teams ct on ct.team_id = a.current_team_id
        where ct.coach_id = auth.uid()
      )
      -- Parents of those athletes
      or id in (
        select pa.parent_id
        from parent_athletes pa
        join athletes a on a.id = pa.athlete_id
        join coach_teams ct on ct.team_id = a.current_team_id
        where ct.coach_id = auth.uid()
      )
    )
  );

-- Parents can read the profile of their own child(ren) (when those
-- athletes have linked user accounts).
create policy "parents_read_child_profiles"
  on profiles for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and id in (
      select a.user_id
      from athletes a
      join parent_athletes pa on pa.athlete_id = a.id
      where pa.parent_id = auth.uid()
    )
  );

-- ============================================================
-- ATHLETES
-- ============================================================

create policy "admins_full_access_athletes"
  on athletes for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "coaches_read_roster_athletes"
  on athletes for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and current_team_id in (
      select team_id from coach_teams where coach_id = auth.uid()
    )
  );

create policy "parents_read_own_children"
  on athletes for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_record"
  on athletes for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and user_id = auth.uid()
  );

-- ============================================================
-- PARENT_ATHLETES
-- ============================================================

create policy "admins_full_access_parent_athletes"
  on parent_athletes for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "parents_read_own_links"
  on parent_athletes for select
  using (parent_id = auth.uid());

create policy "athletes_read_own_links"
  on parent_athletes for select
  using (
    athlete_id in (select id from athletes where user_id = auth.uid())
  );

-- ============================================================
-- TEAMS
-- ============================================================

create policy "admins_full_access_teams"
  on teams for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "coaches_read_own_teams"
  on teams for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and id in (
      select team_id from coach_teams where coach_id = auth.uid()
    )
  );

create policy "parents_read_child_teams"
  on teams for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and id in (
      select a.current_team_id
      from athletes a
      join parent_athletes pa on pa.athlete_id = a.id
      where pa.parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_team"
  on teams for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and id in (
      select current_team_id from athletes where user_id = auth.uid()
    )
  );

-- ============================================================
-- COACH_TEAMS
-- ============================================================

create policy "admins_full_access_coach_teams"
  on coach_teams for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "coaches_read_own_coach_teams"
  on coach_teams for select
  using (coach_id = auth.uid());

create policy "parents_read_child_coach_teams"
  on coach_teams for select
  using (
    get_user_role() = 'parent'
    and team_id in (
      select a.current_team_id
      from athletes a
      join parent_athletes pa on pa.athlete_id = a.id
      where pa.parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_coach_teams"
  on coach_teams for select
  using (
    get_user_role() = 'athlete'
    and team_id in (
      select current_team_id from athletes where user_id = auth.uid()
    )
  );

-- ============================================================
-- ATHLETE_TEAMS
-- ============================================================

create policy "admins_full_access_athlete_teams"
  on athlete_teams for all
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "coaches_read_roster_athlete_teams"
  on athlete_teams for select
  using (
    get_user_role() = 'coach'
    and team_id in (
      select team_id from coach_teams where coach_id = auth.uid()
    )
  );

create policy "parents_read_child_athlete_teams"
  on athlete_teams for select
  using (
    get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_athlete_teams"
  on athlete_teams for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (select id from athletes where user_id = auth.uid())
  );

-- ============================================================
-- KNOWLEDGE_BASE_ITEMS
--
-- Admins manage the library. Everyone else in the org reads it so
-- coaches can hand out drills, athletes can browse the activity in
-- their plan, and parents can read what their child is being asked
-- to do. Inactive items are hidden from non-admin reads.
-- ============================================================

create policy "admins_full_access_kb"
  on knowledge_base_items for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "members_read_active_kb"
  on knowledge_base_items for select
  using (
    org_id = get_user_org()
    and get_user_role() in ('coach', 'parent', 'athlete')
    and is_active = true
  );

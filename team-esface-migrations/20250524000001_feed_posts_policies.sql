-- ============================================================
-- Team Esface — Feed posts RLS
--
-- feed_posts had RLS enabled at schema time but no policies, so
-- every read returned zero rows. Now wires up the four roles:
--
--   admin   → full access in their org
--   coach   → read org-wide + posts on teams they coach; write to
--             teams they coach
--   parent  → read org-wide + posts on the team(s) of their child(ren)
--   athlete → read org-wide + posts on their current team
--
-- Applied to the hosted project via MCP; this file is here so
-- local dev stays in sync.
-- ============================================================

create policy "admins_full_access_feed_posts"
  on feed_posts for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_write_team_feed_posts"
  on feed_posts for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and team_id is not null
    and team_id in (select team_id from coach_teams where coach_id = auth.uid())
  );

create policy "coaches_read_feed_posts"
  on feed_posts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and (
      team_id is null
      or team_id in (select team_id from coach_teams where coach_id = auth.uid())
    )
  );

create policy "parents_read_feed_posts"
  on feed_posts for select
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

create policy "athletes_read_feed_posts"
  on feed_posts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and (
      team_id is null
      or team_id in (
        select current_team_id
        from athletes
        where user_id = auth.uid()
      )
    )
  );

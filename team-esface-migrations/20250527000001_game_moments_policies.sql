-- ============================================================
-- Game moments — RLS for the four roles + two seed clips.
--
--   admin   → full in their org (joined through athletes.org_id)
--   parent  → read / insert / delete clips for their child(ren).
--             uploaded_by must match auth.uid() on insert.
--   coach   → read clips for athletes on teams they coach
--   athlete → read clips uploaded for themselves
--
-- Already applied to the hosted project via MCP; this file is here
-- so local and remote stay in sync. Uses the
-- current_user_child_athlete_ids / current_user_coach_team_ids
-- SECURITY DEFINER helpers introduced earlier so the policies
-- don't re-open the athletes ⟷ parent_athletes ⟷ coach_teams
-- recursion the previous fix closed.
-- ============================================================

create policy "admins_full_access_game_moments"
  on game_moments for all
  using (
    get_user_role() = 'admin'
    and athlete_id in (
      select id from athletes where org_id = get_user_org()
    )
  )
  with check (
    get_user_role() = 'admin'
    and athlete_id in (
      select id from athletes where org_id = get_user_org()
    )
  );

create policy "parents_read_child_game_moments"
  on game_moments for select
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

create policy "parents_insert_child_game_moments"
  on game_moments for insert
  with check (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
    and uploaded_by = auth.uid()
  );

create policy "parents_delete_own_game_moments"
  on game_moments for delete
  using (
    get_user_role() = 'parent'
    and uploaded_by = auth.uid()
  );

create policy "coaches_read_roster_game_moments"
  on game_moments for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select id from athletes
      where current_team_id = any (current_user_coach_team_ids())
    )
  );

create policy "athletes_read_own_game_moments"
  on game_moments for select
  using (
    get_user_role() = 'athlete'
    and athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );

-- Seed two clips for Aaliyah so the moments rail / profile section
-- has content out of the gate.

insert into game_moments
  (id, athlete_id, uploaded_by, video_url, thumbnail_url, duration_seconds, date, notes, team_id)
values
  ('dd000000-0000-0000-0000-000000000001',
   '66666666-6666-6666-6666-666666666662',
   '33333333-3333-3333-3333-333333333332',
   'https://www.youtube.com/watch?v=I02tlvr1WnY',
   'https://img.youtube.com/vi/I02tlvr1WnY/hqdefault.jpg',
   360,
   (now() - interval '6 days')::date,
   'Catch-and-shoot reps after Tuesday practice. Released higher than her usual — the work is showing.',
   '55555555-5555-5555-5555-555555555551'),
  ('dd000000-0000-0000-0000-000000000002',
   '66666666-6666-6666-6666-666666666662',
   '33333333-3333-3333-3333-333333333332',
   'https://www.youtube.com/watch?v=xQGzqlrqM5o',
   'https://img.youtube.com/vi/xQGzqlrqM5o/hqdefault.jpg',
   180,
   (now() - interval '14 days')::date,
   'Game vs. Oakland Stars, second quarter. Three assists in the first three minutes. Floor general mode.',
   '55555555-5555-5555-5555-555555555551')
on conflict (id) do nothing;

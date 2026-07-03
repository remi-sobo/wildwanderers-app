-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase A · Migration 4 of 5 — post-game debriefs
--
-- A coach records a voice note after a game; Deepgram transcribes it
-- and Claude structures it into a three-section summary the coach
-- reviews and publishes to the team feed.
--
--   status flow: recording → processing → review → published
--                                                 ↘ discarded
-- ============================================================

create type debrief_status as enum (
  'recording', 'processing', 'review', 'published', 'discarded'
);

create table game_debriefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  team_id uuid references teams(id) not null,
  game_event_id uuid references schedule_events(id),  -- optional link to the game
  voice_note_url text,
  voice_duration_seconds int,
  transcript text,
  ai_what_went_well text,
  ai_what_needs_work text,
  ai_focus_this_week text,
  ai_formatted_post text,
  coach_edited_post text,
  status debrief_status default 'recording',
  feed_post_id uuid references feed_posts(id),        -- set when published
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

create index game_debriefs_coach_id_idx on game_debriefs (coach_id, status);
create index game_debriefs_team_id_idx on game_debriefs (team_id);

alter table game_debriefs enable row level security;

create policy "admins_full_access_game_debriefs"
  on game_debriefs for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_own_game_debriefs"
  on game_debriefs for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  );

-- Parents and athletes only ever see a debrief once it's published,
-- and only for their own team.
create policy "athletes_read_published_debriefs"
  on game_debriefs for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and status = 'published'
    and team_id = current_user_athlete_team_id()
  );

create policy "parents_read_published_debriefs"
  on game_debriefs for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and status = 'published'
    and team_id = any (current_user_child_team_ids())
  );

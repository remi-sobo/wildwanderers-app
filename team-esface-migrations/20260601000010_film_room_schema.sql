-- ============================================================
-- Team Esface — Film Room
-- Phase A · Core schema
--
-- Four new tables:
--   film_clips          — raw video files, any role can upload
--   film_breakdowns     — coach-authored breakdown on a clip
--   breakdown_views     — watch-progress per viewer
--   breakdown_responses — athlete text/voice responses
--
-- Three new enum types:
--   breakdown_audience  (athlete | team | org)
--   breakdown_status    (draft | published | archived)
--   response_format     (text | voice)
--
-- RLS uses the existing SECURITY DEFINER helpers:
--   get_user_role(), get_user_org(), auth.uid()
--   current_user_athlete_id(), current_user_athlete_team_id()
--   current_user_child_athlete_ids(), current_user_child_team_ids()
--   current_user_coach_team_ids()
-- ============================================================

-- ── Enum types ──────────────────────────────────────────────

create type breakdown_audience as enum ('athlete', 'team', 'org');
create type breakdown_status   as enum ('draft', 'published', 'archived');
create type response_format    as enum ('text', 'voice');

-- ── film_clips ───────────────────────────────────────────────
-- Raw video clips uploaded by any authenticated role.
-- Storage path is set by the upload flow; this row tracks metadata
-- and status so the clip library can render before Storage finishes.

create table film_clips (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) not null,
  uploaded_by      uuid references profiles(id) not null,
  uploader_role    user_role not null,
  athlete_id       uuid references athletes(id),
  team_id          uuid references teams(id),
  game_event_id    uuid references schedule_events(id),
  title            text,
  description      text,
  video_url        text not null,
  thumbnail_url    text,
  duration_seconds int,
  file_size_bytes  bigint,
  status           text default 'ready'
    check (status in ('uploading', 'processing', 'ready', 'error')),
  created_at       timestamptz default now()
);

create index film_clips_org_idx        on film_clips (org_id, created_at desc);
create index film_clips_team_idx       on film_clips (team_id);
create index film_clips_athlete_idx    on film_clips (athlete_id);
create index film_clips_uploader_idx   on film_clips (uploaded_by);

-- ── film_breakdowns ──────────────────────────────────────────
-- Coach-authored breakdown layered on top of a clip.
-- voiceover_url points to an audio file in Supabase Storage.
-- annotations is a JSONB array:
--   [{ id, timestamp_ms, text, type, duration_ms }, ...]
--   type: 'callout' | 'question' | 'highlight'

create table film_breakdowns (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid references organizations(id) not null,
  coach_id                    uuid references profiles(id) not null,
  clip_id                     uuid references film_clips(id) not null,
  title                       text not null,
  audience_type               breakdown_audience not null,
  athlete_id                  uuid references athletes(id),
  team_id                     uuid references teams(id),
  voiceover_url               text,
  voiceover_duration_seconds  int,
  annotations                 jsonb default '[]',
  response_prompt             text,
  response_required           boolean default true,
  mbhs_pillar                 mbhs_pillar default 'mind',
  mbhs_subcategory            text default 'iq',
  status                      breakdown_status default 'draft',
  view_count                  int default 0,
  response_count              int default 0,
  published_at                timestamptz,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index film_breakdowns_coach_idx    on film_breakdowns (coach_id, status);
create index film_breakdowns_team_idx     on film_breakdowns (team_id, status);
create index film_breakdowns_athlete_idx  on film_breakdowns (athlete_id, status);
create index film_breakdowns_clip_idx     on film_breakdowns (clip_id);

-- Auto-update updated_at using the existing set_updated_at trigger function.
create trigger film_breakdowns_updated_at
  before update on film_breakdowns
  for each row execute function set_updated_at();

-- ── breakdown_views ──────────────────────────────────────────
-- Tracks how much of a breakdown each viewer has watched.
-- completed = true when watched_duration >= 90% of clip duration.

create table breakdown_views (
  id                       uuid primary key default gen_random_uuid(),
  breakdown_id             uuid references film_breakdowns(id) not null,
  viewer_id                uuid references profiles(id) not null,
  athlete_id               uuid references athletes(id),
  watched_duration_seconds int default 0,
  completed                boolean default false,
  first_viewed_at          timestamptz default now(),
  last_viewed_at           timestamptz default now(),
  unique (breakdown_id, viewer_id)
);

create index breakdown_views_breakdown_idx on breakdown_views (breakdown_id);
create index breakdown_views_viewer_idx    on breakdown_views (viewer_id);

-- ── breakdown_responses ──────────────────────────────────────
-- Athlete text or voice responses to a breakdown's response_prompt.
-- voice_transcript is populated asynchronously by the
-- transcribe-voice-response Edge Function.

create table breakdown_responses (
  id                uuid primary key default gen_random_uuid(),
  breakdown_id      uuid references film_breakdowns(id) not null,
  athlete_id        uuid references athletes(id) not null,
  response_format   response_format default 'text',
  text_response     text,
  voice_response_url text,
  voice_transcript  text,
  coach_reply       text,
  coach_replied_at  timestamptz,
  submitted_at      timestamptz default now()
);

create index breakdown_responses_breakdown_idx on breakdown_responses (breakdown_id);
create index breakdown_responses_athlete_idx   on breakdown_responses (athlete_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table film_clips          enable row level security;
alter table film_breakdowns     enable row level security;
alter table breakdown_views     enable row level security;
alter table breakdown_responses enable row level security;

-- ─────────────────────────────────────────────────────────────
-- film_clips
-- ─────────────────────────────────────────────────────────────

create policy "admins_full_film_clips"
  on film_clips for all
  using  (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- Coaches read clips they uploaded OR clips on their teams.
create policy "coaches_read_film_clips"
  on film_clips for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and (
      uploaded_by = auth.uid()
      or team_id = any (current_user_coach_team_ids())
    )
  );

-- Coaches can upload clips (any clip; team_id/athlete_id filled later).
create policy "coaches_insert_film_clips"
  on film_clips for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and uploaded_by = auth.uid()
  );

-- Coaches can update clips they uploaded.
create policy "coaches_update_film_clips"
  on film_clips for update
  using  (get_user_role() = 'coach' and uploaded_by = auth.uid())
  with check (get_user_role() = 'coach' and uploaded_by = auth.uid());

-- Parents see clips tagged to their children or on their children's teams.
create policy "parents_read_film_clips"
  on film_clips for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and (
      athlete_id = any (current_user_child_athlete_ids())
      or team_id  = any (current_user_child_team_ids())
    )
  );

-- Parents can upload clips (on behalf of their children).
create policy "parents_insert_film_clips"
  on film_clips for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and uploaded_by = auth.uid()
  );

-- Athletes see clips where they are tagged or on their team.
create policy "athletes_read_film_clips"
  on film_clips for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and (
      athlete_id = current_user_athlete_id()
      or team_id  = current_user_athlete_team_id()
    )
  );

-- Athletes can upload their own clips.
create policy "athletes_insert_film_clips"
  on film_clips for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and uploaded_by = auth.uid()
  );

-- Uploaders can update their own clips (set title, duration, thumbnail, status).
create policy "uploaders_update_film_clips"
  on film_clips for update
  using  (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- film_breakdowns
-- ─────────────────────────────────────────────────────────────

create policy "admins_full_film_breakdowns"
  on film_breakdowns for all
  using  (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- Coaches own all access to their own breakdowns.
create policy "coaches_own_film_breakdowns"
  on film_breakdowns for all
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

-- Parents see published breakdowns for their children's athlete assignment
-- or their children's team (or org-wide).
create policy "parents_read_published_breakdowns"
  on film_breakdowns for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and status = 'published'
    and (
      athlete_id = any (current_user_child_athlete_ids())
      or team_id  = any (current_user_child_team_ids())
      or audience_type = 'org'
    )
  );

-- Athletes see published breakdowns assigned to them, to their team,
-- or org-wide.
create policy "athletes_read_published_breakdowns"
  on film_breakdowns for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and status = 'published'
    and (
      athlete_id = current_user_athlete_id()
      or team_id  = current_user_athlete_team_id()
      or audience_type = 'org'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- breakdown_views
-- ─────────────────────────────────────────────────────────────

-- Each user fully manages their own view record.
create policy "viewers_own_views"
  on breakdown_views for all
  using  (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());

-- Coaches read view records for breakdowns they authored.
create policy "coaches_read_breakdown_views"
  on breakdown_views for select
  using (
    get_user_role() = 'coach'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_views.breakdown_id
        and fb.coach_id = auth.uid()
    )
  );

-- Admins read all view records in their org.
create policy "admins_read_breakdown_views"
  on breakdown_views for select
  using (
    get_user_role() = 'admin'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_views.breakdown_id
        and fb.org_id = get_user_org()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- breakdown_responses
-- ─────────────────────────────────────────────────────────────

-- Admins see all responses in their org.
create policy "admins_full_breakdown_responses"
  on breakdown_responses for all
  using (
    get_user_role() = 'admin'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_responses.breakdown_id
        and fb.org_id = get_user_org()
    )
  )
  with check (
    get_user_role() = 'admin'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_responses.breakdown_id
        and fb.org_id = get_user_org()
    )
  );

-- Coaches see all responses for their breakdowns, and can update
-- to add coach_reply + coach_replied_at.
create policy "coaches_manage_responses"
  on breakdown_responses for all
  using (
    get_user_role() = 'coach'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_responses.breakdown_id
        and fb.coach_id = auth.uid()
    )
  )
  with check (
    get_user_role() = 'coach'
    and exists (
      select 1 from film_breakdowns fb
      where fb.id = breakdown_responses.breakdown_id
        and fb.coach_id = auth.uid()
    )
  );

-- Athletes can insert and read their own responses.
-- No update or delete — submitted responses are final.
create policy "athletes_insert_own_responses"
  on breakdown_responses for insert
  with check (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  );

create policy "athletes_read_own_responses"
  on breakdown_responses for select
  using (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  );

-- Parents read their children's responses.
create policy "parents_read_athlete_responses"
  on breakdown_responses for select
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  );

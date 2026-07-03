-- ============================================================
-- Team Esface — Initial Schema
-- Sprint 0, Day 1
--
-- Creates the full database for the platform:
--   * Organizations, profiles, teams, athletes, relationships
--   * MBHS evaluations and review sessions
--   * Knowledge base (with pgvector embeddings)
--   * Transformation plans, days, activities, completions
--   * Milestones, schedule, feed, game moments, season summaries
--   * Row Level Security enabled on every table
--   * Helper functions: get_user_role(), get_user_org()
--   * Core RLS policies on `evaluations` for all four roles
--     (admin, coach, parent, athlete) — pattern to replicate
--     for the remaining tables in follow-up migrations.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================
-- CORE ORGANIZATION
-- ============================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text default '#CC0000',
  secondary_color text default '#000000',
  created_at timestamptz default now()
);

-- ============================================================
-- USERS & ROLES
-- ============================================================

create type user_role as enum ('admin', 'coach', 'parent', 'athlete');
create type team_tier as enum ('neo_prep', 'true_league', 'black_club');
create type grade_tier as enum ('elementary', 'middle', 'high_school');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  role user_role not null,
  first_name text not null,
  last_name text not null,
  avatar_url text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TEAMS & ATHLETES
-- ============================================================

create table teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  tier team_tier not null,
  grade_tier grade_tier not null,
  season text not null,                              -- e.g. '2025-26'
  head_coach_id uuid references profiles(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id),              -- null for young athletes without logins
  first_name text not null,
  last_name text not null,
  grade int not null check (grade between 1 and 12),
  grade_tier grade_tier not null,
  date_of_birth date,
  photo_url text,
  jersey_number int,
  position text,
  tier team_tier not null,
  current_team_id uuid references teams(id),
  current_plan_id uuid,                              -- FK added after transformation_plans is created
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table parent_athletes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references profiles(id) not null,
  athlete_id uuid references athletes(id) not null,
  relationship text default 'parent',
  unique (parent_id, athlete_id)
);

create table coach_teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references profiles(id) not null,
  team_id uuid references teams(id) not null,
  role text default 'head' check (role in ('head', 'assistant')),
  season text not null,
  unique (coach_id, team_id, season)
);

create table athlete_teams (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) not null,
  team_id uuid references teams(id) not null,
  season text not null,
  joined_at timestamptz default now(),
  left_at timestamptz,
  unique (athlete_id, team_id, season)
);

-- ============================================================
-- MBHS EVALUATIONS
-- ============================================================

create type evaluation_type as enum ('mid_season', 'end_season', 'tryout');
create type evaluation_status as enum ('draft', 'pending_review', 'completed');

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  athlete_id uuid references athletes(id) not null,
  coach_id uuid references profiles(id) not null,
  team_id uuid references teams(id),
  season text not null,
  type evaluation_type not null,
  status evaluation_status default 'draft',

  -- MIND ratings (1-5)
  mind_iq int check (mind_iq between 1 and 5),
  mind_next_play_speed int check (mind_next_play_speed between 1 and 5),
  mind_focus int check (mind_focus between 1 and 5),
  mind_anti_softness int check (mind_anti_softness between 1 and 5),

  -- BODY ratings — earned
  body_explosiveness int check (body_explosiveness between 1 and 5),
  body_stability int check (body_stability between 1 and 5),
  body_stamina int check (body_stamina between 1 and 5),
  -- BODY ratings — natural (displayed, not trained)
  body_speed int check (body_speed between 1 and 5),
  body_length int check (body_length between 1 and 5),

  -- HEART ratings (1-5)
  heart_humble_teammate int check (heart_humble_teammate between 1 and 5),
  heart_humble_coachable int check (heart_humble_coachable between 1 and 5),
  heart_positive int check (heart_positive between 1 and 5),
  heart_hunger int check (heart_hunger between 1 and 5),

  -- SKILL ratings (1-5)
  skill_ball_handling int check (skill_ball_handling between 1 and 5),
  skill_finishing int check (skill_finishing between 1 and 5),
  skill_passing int check (skill_passing between 1 and 5),
  skill_shooting int check (skill_shooting between 1 and 5),
  skill_on_ball_defense int check (skill_on_ball_defense between 1 and 5),
  skill_off_ball_defense int check (skill_off_ball_defense between 1 and 5),

  -- Top-line summary (from evaluation)
  primary_strength text,
  secondary_strength text,
  primary_opportunity text,
  secondary_opportunity text,

  -- Coach note
  coach_note text,
  voice_note_url text,                              -- raw recording stored in Supabase Storage
  voice_transcript text,                            -- Deepgram transcription
  ai_formatted_note text,                           -- Claude-formatted version (coach reviews and edits)

  created_at timestamptz default now(),
  completed_at timestamptz,
  updated_at timestamptz default now()
);

-- ============================================================
-- REVIEW SESSIONS
-- ============================================================

create type review_session_status as enum ('pending', 'scheduled', 'completed', 'skipped');

create table review_sessions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid references evaluations(id) not null,
  athlete_id uuid references athletes(id) not null,
  coach_id uuid references profiles(id) not null,
  status review_session_status default 'pending',
  scheduled_at timestamptz,
  completed_at timestamptz,
  session_notes text,                               -- what the coach noted during the session
  created_at timestamptz default now()
);

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================

create type activity_type as enum ('watch', 'read', 'think', 'do', 'with_parent', 'reflect');
create type mbhs_pillar as enum ('mind', 'body', 'heart', 'skill');
create type skill_level as enum ('beginner', 'intermediate', 'advanced');

create table knowledge_base_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  description text,
  activity_type activity_type not null,
  pillar mbhs_pillar not null,
  subcategory text not null,                        -- matches exact MBHS subcategory slugs
  grade_tiers grade_tier[] not null,                -- can apply to multiple tiers
  skill_level skill_level default 'beginner',
  duration_minutes int default 10,
  content_url text,                                 -- video URL, article URL
  instructions text,                                -- for Do activities
  coaching_points text,                             -- what to look for
  is_non_negotiable boolean default false,          -- flags core Esface content
  is_anti_softness boolean default false,           -- flags Anti-Softness campaign content
  embedding vector(1536),                           -- pgvector for semantic search
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index knowledge_base_items_embedding_idx
  on knowledge_base_items
  using ivfflat (embedding vector_cosine_ops);

-- ============================================================
-- TRANSFORMATION PLANS
-- ============================================================

create type plan_status as enum ('draft', 'pending_approval', 'active', 'completed', 'archived');

create table transformation_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  athlete_id uuid references athletes(id) not null,
  evaluation_id uuid references evaluations(id),    -- what triggered this plan
  coach_id uuid references profiles(id),
  focus_pillar mbhs_pillar not null,
  focus_subcategories text[] not null,
  non_negotiable_focus text,                        -- which of the 4 non-negotiables this targets
  duration_weeks int not null check (duration_weeks in (2, 3, 5)),
  status plan_status default 'draft',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  start_date date,
  end_date date,
  ai_generated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Now that transformation_plans exists, wire up athletes.current_plan_id
alter table athletes
  add constraint fk_current_plan
  foreign key (current_plan_id)
  references transformation_plans(id);

create table plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references transformation_plans(id) on delete cascade not null,
  day_number int not null,                          -- 1-35 (max 5 weeks)
  week_number int not null,
  theme text,
  created_at timestamptz default now(),
  unique (plan_id, day_number)
);

create table plan_activities (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid references plan_days(id) on delete cascade not null,
  knowledge_base_item_id uuid references knowledge_base_items(id),
  activity_type activity_type not null,
  title text not null,
  content text,                                     -- instructions or text content
  media_url text,                                   -- video or image URL
  duration_minutes int default 10,
  sort_order int not null,
  is_required boolean default true,
  created_at timestamptz default now()
);

create table activity_completions (
  id uuid primary key default gen_random_uuid(),
  plan_activity_id uuid references plan_activities(id) not null,
  athlete_id uuid references athletes(id) not null,
  completed_at timestamptz default now(),
  reflection_notes text,                            -- for Reflect activity type
  unique (plan_activity_id, athlete_id)
);

-- ============================================================
-- MILESTONES
-- ============================================================

create type milestone_trigger as enum ('automatic', 'manual');
create type milestone_category as enum (
  'plan_completion', 'squad_graduation', 'team_achievement',
  'training_consistency', 'evaluation_growth', 'program_participation'
);

create table milestone_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  description text not null,
  category milestone_category not null,
  trigger_type milestone_trigger default 'manual',
  trigger_config jsonb,                             -- { "plans_completed": 1 } or { "days_streak": 30 }
  icon_name text,                                   -- maps to icon in the UI
  sort_order int default 0,
  created_at timestamptz default now()
);

create table athlete_milestones (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) not null,
  milestone_definition_id uuid references milestone_definitions(id) not null,
  earned_at timestamptz default now(),
  awarded_by uuid references profiles(id),
  note text,
  unique (athlete_id, milestone_definition_id)
);

-- ============================================================
-- SCHEDULE
-- ============================================================

create type event_type as enum (
  'practice', 'game', 'tournament', 'evaluation_window',
  'review_period', 'team_meeting', 'tryout'
);

create table schedule_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  team_id uuid references teams(id),                -- null = all teams
  type event_type not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  opponent text,                                    -- for games
  notes text,
  is_cancelled boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PROGRAM FEED
-- ============================================================

create type feed_post_type as enum (
  'announcement', 'tournament_briefing', 'highlight', 'update', 'milestone_shoutout'
);

create table feed_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  team_id uuid references teams(id),                -- null = org-wide
  title text not null,
  content text not null,
  type feed_post_type not null,
  created_by uuid references profiles(id),
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- GAME MOMENTS
-- ============================================================

create table game_moments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) not null,
  uploaded_by uuid references profiles(id) not null,
  video_url text not null,
  thumbnail_url text,
  duration_seconds int,
  date date not null,
  notes text,
  team_id uuid references teams(id),
  event_id uuid references schedule_events(id),     -- optional link to a game
  created_at timestamptz default now()
);

-- ============================================================
-- SEASON SUMMARIES
-- ============================================================

create table season_summaries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references athletes(id) not null,
  org_id uuid references organizations(id) not null,
  season text not null,
  snapshot jsonb not null,                          -- full evaluation data, milestones, plan completions
  share_token text unique default encode(gen_random_bytes(16), 'hex'),
  generated_at timestamptz default now(),
  unique (athlete_id, season)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table. Policies for the remaining tables follow
-- the `evaluations` pattern below and will be added in subsequent
-- migrations as each feature ships. Until those policies exist, RLS
-- defaults to deny-all for non-service-role connections — which is
-- the safe stance during development.

alter table organizations         enable row level security;
alter table profiles              enable row level security;
alter table teams                 enable row level security;
alter table athletes              enable row level security;
alter table parent_athletes       enable row level security;
alter table coach_teams           enable row level security;
alter table athlete_teams         enable row level security;
alter table evaluations           enable row level security;
alter table review_sessions       enable row level security;
alter table knowledge_base_items  enable row level security;
alter table transformation_plans  enable row level security;
alter table plan_days             enable row level security;
alter table plan_activities       enable row level security;
alter table activity_completions  enable row level security;
alter table milestone_definitions enable row level security;
alter table athlete_milestones    enable row level security;
alter table schedule_events       enable row level security;
alter table feed_posts            enable row level security;
alter table game_moments          enable row level security;
alter table season_summaries      enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Current user's role, used inside RLS policies.
create or replace function get_user_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Current user's organization, used inside RLS policies.
create or replace function get_user_org()
returns uuid as $$
  select org_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- RLS POLICIES — evaluations (pattern for all four roles)
-- ============================================================
--
-- Access rules:
--   admin    → full access to all evaluations in their org
--   coach    → full access to evaluations they authored, in their org
--   parent   → read-only access to evaluations for their linked athlete(s)
--   athlete  → read-only access to their own evaluations
--
-- Copy this pattern when adding policies for athletes, plans, etc.
-- ============================================================

create policy "admins_full_access_evaluations"
  on evaluations for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'admin'
  );

create policy "coaches_own_evaluations"
  on evaluations for all
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

create policy "parents_read_child_evaluations"
  on evaluations for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and athlete_id in (
      select athlete_id from parent_athletes where parent_id = auth.uid()
    )
  );

create policy "athletes_read_own_evaluations"
  on evaluations for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and athlete_id in (
      select id from athletes where user_id = auth.uid()
    )
  );

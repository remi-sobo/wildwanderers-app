-- ============================================================
-- FIRST IMPRESSIONS & PROTECTION OF KIDS (Phase 3) — schema
-- ============================================================
-- Three Phase 3 features need columns/tables:
--
--  1. Coach evaluation autosave: an 18-input form with no draft
--     meant a network drop lost 15 minutes of coach work. Drafts
--     live server-side (one per coach+athlete) so they survive
--     device switches, not just reloads.
--
--  2. Photo/video consent: parents upload footage that includes
--     other people's children. Capture an explicit confirmation at
--     upload time and give HQ a takedown lever.
--
--  3. Onboarding: a first-run walkthrough needs a per-profile
--     "seen it" stamp that works across devices.

-- ── 1. Evaluation drafts ──────────────────────────────────────
create table if not exists evaluation_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  coach_id uuid not null references profiles(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  form_data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (coach_id, athlete_id)
);

create index if not exists evaluation_drafts_coach_idx
  on evaluation_drafts (coach_id, updated_at desc);

alter table evaluation_drafts enable row level security;

drop policy if exists "coaches_own_evaluation_drafts" on evaluation_drafts;
create policy "coaches_own_evaluation_drafts"
  on evaluation_drafts for all
  using (coach_id = (select auth.uid()))
  with check (
    coach_id = (select auth.uid())
    and get_user_role() = 'coach'
    and org_id = get_user_org()
  );

-- ── 2. Consent + takedown on video surfaces ───────────────────
alter table film_clips
  add column if not exists consent_confirmed boolean not null default false,
  add column if not exists taken_down_at timestamptz,
  add column if not exists taken_down_by uuid references profiles(id);

alter table game_moments
  add column if not exists consent_confirmed boolean not null default false,
  add column if not exists taken_down_at timestamptz,
  add column if not exists taken_down_by uuid references profiles(id);

-- Existing rows predate the consent flow; leaving them false is
-- honest — consent was never captured for them.

-- ── 3. Onboarding stamp ───────────────────────────────────────
alter table profiles
  add column if not exists onboarded_at timestamptz;

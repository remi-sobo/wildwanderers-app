-- ============================================================
-- GYM-READY (Phase 5) — practice RSVP + ICS calendar feeds
-- ============================================================
-- Two real-world gym features from the audit:
--
--  1. RSVP ("who's coming Tuesday?") — the #1 coach pain. Parents
--     (or the athlete, grades 7+) answer In / Out in two taps;
--     coaches see the tally per event. One row per event+athlete,
--     last response wins.
--
--  2. ICS calendar feeds — every team gets an unguessable token so
--     families can subscribe from Apple/Google Calendar. Same
--     pattern as season share tokens: anon-callable SECURITY
--     DEFINER lookup keyed on a 128-bit token.

-- ── 1. Event RSVPs ────────────────────────────────────────────
create table if not exists event_rsvps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  event_id uuid not null references schedule_events(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  status text not null check (status in ('in', 'out')),
  responded_by uuid not null references profiles(id),
  responded_at timestamptz not null default now(),
  unique (event_id, athlete_id)
);

create index if not exists event_rsvps_event_idx   on event_rsvps (event_id);
create index if not exists event_rsvps_athlete_idx on event_rsvps (athlete_id);

alter table event_rsvps enable row level security;

drop policy if exists "admins_full_event_rsvps" on event_rsvps;
create policy "admins_full_event_rsvps"
  on event_rsvps for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

-- Parents answer for their kids.
drop policy if exists "parents_write_child_event_rsvps" on event_rsvps;
create policy "parents_write_child_event_rsvps"
  on event_rsvps for all
  using (
    get_user_role() = 'parent'
    and athlete_id = any (current_user_child_athlete_ids())
  )
  with check (
    get_user_role() = 'parent'
    and org_id = get_user_org()
    and athlete_id = any (current_user_child_athlete_ids())
    and responded_by = (select auth.uid())
  );

-- Athletes (grades 7+ have logins) answer for themselves.
drop policy if exists "athletes_write_own_event_rsvps" on event_rsvps;
create policy "athletes_write_own_event_rsvps"
  on event_rsvps for all
  using (
    get_user_role() = 'athlete'
    and athlete_id = current_user_athlete_id()
  )
  with check (
    get_user_role() = 'athlete'
    and org_id = get_user_org()
    and athlete_id = current_user_athlete_id()
    and responded_by = (select auth.uid())
  );

-- Coaches read the tally for their roster.
drop policy if exists "coaches_read_roster_event_rsvps" on event_rsvps;
create policy "coaches_read_roster_event_rsvps"
  on event_rsvps for select
  using (
    get_user_role() = 'coach'
    and athlete_id in (
      select a.id from athletes a
      where a.current_team_id = any (current_user_coach_team_ids())
    )
  );

-- ── 2. ICS calendar tokens ────────────────────────────────────
alter table teams
  add column if not exists ics_token text unique
    default encode(gen_random_bytes(16), 'hex');

-- Backfill any pre-existing rows that predate the default.
update teams set ics_token = encode(gen_random_bytes(16), 'hex')
where ics_token is null;

-- Calendar apps poll without cookies: the feed route runs as anon
-- and resolves the team + its events through this definer lookup.
-- Returns null for an unknown token. Events stretch 30 days back
-- (so a just-finished game doesn't vanish mid-week) and include
-- org-wide events alongside the team's own.
create or replace function public.get_team_calendar_by_ics_token(token text)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'team_name', t.name,
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'type', e.type,
            'title', e.title,
            'start_at', e.start_at,
            'end_at', e.end_at,
            'location', e.location,
            'opponent', e.opponent,
            'notes', e.notes,
            'is_cancelled', e.is_cancelled,
            'updated_at', e.updated_at
          )
          order by e.start_at
        )
        from schedule_events e
        where (e.team_id = t.id or e.team_id is null)
          and e.org_id = t.org_id
          and e.start_at > now() - interval '30 days'
      ),
      '[]'::jsonb
    )
  )
  from teams t
  where t.ics_token = token
  limit 1;
$$;

revoke execute on function public.get_team_calendar_by_ics_token(text) from public;
grant  execute on function public.get_team_calendar_by_ics_token(text) to anon, authenticated;

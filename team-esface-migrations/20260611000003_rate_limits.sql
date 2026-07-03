-- ============================================================
-- LOCK THE DOORS (3/5) — per-profile rate limiting
-- ============================================================
-- The AI endpoints (Claude plan generation) and the film upload-url
-- mint had no quota: budget drain and an enumeration probe surface.
-- This adds a tiny DB-backed sliding-window limiter — no new infra,
-- works across serverless instances (in-memory counters don't).
--
-- The table is reachable only through the SECURITY DEFINER
-- `consume_rate_limit` RPC: RLS is enabled with no policies and all
-- direct table privileges are revoked.

create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_window_idx
  on rate_limit_events (profile_id, action, created_at desc);

alter table rate_limit_events enable row level security;

revoke all on table rate_limit_events from public, anon, authenticated;

-- Records one attempt and reports whether the caller is still inside
-- their window. Returns false when the quota is exhausted (the
-- attempt is NOT recorded in that case, so a user hammering a full
-- bucket doesn't push their own reset further out... it's a fixed
-- sliding window over successful consumptions).
create or replace function public.consume_rate_limit(
  p_action text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
volatile
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return false;
  end if;
  if p_limit is null or p_limit <= 0 or p_window_seconds is null or p_window_seconds <= 0 then
    return false;
  end if;

  select count(*)
    into v_count
    from rate_limit_events
   where profile_id = v_uid
     and action = p_action
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limit_events (profile_id, action) values (v_uid, p_action);

  -- Opportunistic cleanup so the table never grows unbounded.
  delete from rate_limit_events
   where profile_id = v_uid
     and action = p_action
     and created_at < now() - interval '7 days';

  return true;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon;
grant  execute on function public.consume_rate_limit(text, int, int) to authenticated;

-- ============================================================
-- LOCK THE DOORS (1/5) — definer function grants + search_path
-- ============================================================
-- From the June 2026 security audit (S2, S7):
--
--  S2  Supabase's default privileges grant EXECUTE to `anon` on every
--      new function in `public`, so `revoke ... from public` alone is
--      not enough. `program_leaderboard` and
--      `get_athlete_current_level` were callable by unauthenticated
--      clients via /rest/v1/rpc/... — ranked data about minor
--      athletes behind nothing but a guessable org id.
--
--  S7  `set_updated_at` and `feed_post_visible_to_role` were created
--      without a pinned `search_path` — the one hardening gap in an
--      otherwise consistent set of helpers.
--
-- Everything here is idempotent: REVOKE on an absent grant and a
-- repeated ALTER ... SET are both no-ops, so this is safe to run
-- whether or not the live project already received these statements.

-- ── S7: pin search_path on the two unpinned functions ─────────
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

alter function public.feed_post_visible_to_role(text[], text)
  set search_path = pg_catalog, public;

-- ── S2: close the anon (and where appropriate, authenticated)
--        execute grants on every RPC-reachable function ────────

-- Leaderboard: authenticated-only. The function already refuses
-- cross-org callers internally; this stops anonymous probing.
revoke execute on function public.program_leaderboard(uuid) from public, anon;

-- Level lookup: authenticated-only, same reasoning.
revoke execute on function public.get_athlete_current_level(uuid) from public, anon;

-- Trigger-only function — nobody calls this directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ── Defensive re-assertion on the already-hardened helpers ────
-- These were revoked correctly in their own migrations; repeating the
-- revokes here gives one place that documents (and enforces) the full
-- grant surface, in case any function gets recreated without them.
revoke execute on function public.get_user_role()                     from public, anon;
revoke execute on function public.get_user_org()                      from public, anon;
revoke execute on function public.current_user_child_athlete_ids()    from public, anon;
revoke execute on function public.current_user_child_team_ids()       from public, anon;
revoke execute on function public.current_user_coach_team_ids()       from public, anon;
revoke execute on function public.current_user_athlete_id()           from public, anon;
revoke execute on function public.current_user_athlete_team_id()      from public, anon;
revoke execute on function public.touch_message_thread()              from public, anon, authenticated;
revoke execute on function public.mark_thread_messages_read(uuid)     from public, anon;

-- Intentionally NOT revoked from anon: get_season_summary_by_token —
-- the public share-link page depends on it. It gains an expiry check
-- in the next migration instead.

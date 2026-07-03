-- ============================================================
-- Team Esface — Drop recursive profile policies (HOTFIX)
--
-- The cross-table subselects in coaches_read_roster_profiles and
-- parents_read_child_profiles create an RLS cycle through
-- athletes <-> parent_athletes, which Postgres detects at query
-- plan time and rejects with "infinite recursion detected in
-- policy for relation ...". This was breaking every authenticated
-- read of profiles, including the middleware's role lookup — so
-- nobody could sign in.
--
-- These two policies were nice-to-haves for V1: the app reads
-- athlete names from athletes.first_name / athletes.last_name
-- directly, not from profiles. Drop them now; a follow-up
-- (recursion-free) version can come back via SECURITY DEFINER
-- helper functions that hide the subselects from the planner.
--
-- Already applied to the hosted project via MCP; this file is
-- here so local and remote agree.
-- ============================================================

drop policy if exists "coaches_read_roster_profiles" on public.profiles;
drop policy if exists "parents_read_child_profiles" on public.profiles;

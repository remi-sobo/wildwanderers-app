-- ============================================================
-- SPRINT C (Ring 1) -- two-way messaging: family replies
-- ============================================================
-- Parents and athletes can now reply inside a thread they are a
-- participant of. Until now only coaches could insert into
-- `messages` (20260601000002); recipients were read-only.
--
-- The wall is the thread SELECT policies' wall, mirrored exactly:
--
--  * parent: the thread targets parents (`recipient_type` in
--    ('parent','both')) and its athlete is one of the caller's
--    children (`current_user_child_athlete_ids()`), same org.
--  * athlete: the thread targets athletes (`recipient_type` in
--    ('athlete','both')) and its athlete is the caller's own row
--    (`current_user_athlete_id()`), same org.
--
-- Both subqueries also run under the caller's own RLS on
-- message_threads, so the read policy is asserted twice over.
--
-- Sender identity is pinned: sender_id must be the caller and
-- sender_role must match the caller's actual role, so a family
-- member cannot speak as the coach.
--
-- Deliberately absent:
--  * NO UPDATE or DELETE policies -- messages stay immutable for
--    families (read receipts flow through the SECURITY DEFINER
--    mark_thread_messages_read RPC, unchanged).
--  * NO change to message_threads -- thread creation stays
--    coach-only.
--
-- Initplan pattern per 20260611000005: auth.uid() is written as
-- (select auth.uid()) so it evaluates once per statement.

create policy "parents_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and sender_id = (select auth.uid())
    and sender_role = 'parent'
    and thread_id in (
      select t.id from message_threads t
      where t.org_id = get_user_org()
        and t.recipient_type in ('parent', 'both')
        and t.athlete_id = any (current_user_child_athlete_ids())
    )
  );

create policy "athletes_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and sender_id = (select auth.uid())
    and sender_role = 'athlete'
    and thread_id in (
      select t.id from message_threads t
      where t.org_id = get_user_org()
        and t.recipient_type in ('athlete', 'both')
        and t.athlete_id = current_user_athlete_id()
    )
  );

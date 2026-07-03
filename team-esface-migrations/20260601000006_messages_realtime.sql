-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase B · direct-message realtime
--
-- Add `messages` to the supabase_realtime publication so the thread
-- view can subscribe to INSERT (new message) and UPDATE (read receipt)
-- events. Realtime honors RLS, so each subscriber only receives rows
-- their SELECT policy already allows — recipients see only their own
-- thread's messages.
-- ============================================================

alter publication supabase_realtime add table messages;

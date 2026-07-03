-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase F · notifications realtime
--
-- Add `notifications` to the Supabase Realtime publication so the
-- notification bell can subscribe to INSERT events and increment its
-- badge count live without polling.
-- ============================================================

alter publication supabase_realtime add table notifications;

-- ============================================================
-- Team Esface — Self-Directed Training notifications
-- Build order step 8
--
-- New notification_type values for the self-directed training events.
-- Coach → family events fan out through the existing edge function;
-- athlete/parent → coach events are written server-side with the
-- service role (the edge function is coach/admin-only by design).
-- ============================================================

alter type notification_type add value if not exists 'self_directed_plan_created';
alter type notification_type add value if not exists 'self_directed_plan_approved';
alter type notification_type add value if not exists 'self_directed_plan_feedback';
alter type notification_type add value if not exists 'self_directed_swap_suggested';
alter type notification_type add value if not exists 'self_directed_swap_responded';

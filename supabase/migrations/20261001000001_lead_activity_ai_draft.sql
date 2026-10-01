-- ============================================================
-- Wild Wanderers — Speed to lead, part 4: the ai_draft activity kind
--
-- Scout's drafted first reply is stored on the lead's timeline so every
-- draft is auditable: what was suggested, when. The app never sends it;
-- Gabe copies, edits, and sends from his own phone or inbox. ai_calls logs
-- ids and token counts only, never this content. Covered by the existing
-- owner-only lead_activities RLS.
-- ============================================================

alter type lead_activity_kind add value if not exists 'ai_draft';

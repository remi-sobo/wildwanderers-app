-- ============================================================
-- Wild Wanderers — Pop-up roll call, part 1: the waiver kind
--
-- The Saturday pop-up waiver is an adult document (with a parent or guardian
-- path for ages 10 to 17), separate from the boys program waiver that already
-- holds form_kind 'waiver'. A new enum value cannot be used in the same
-- transaction that adds it, so it lands on its own before part 2 seeds it.
-- (specs/popup-roll-call.md)
-- ============================================================

alter type form_kind add value if not exists 'popup_waiver';

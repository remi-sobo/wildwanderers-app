-- ============================================================
-- Wild Wanderers — The Saturday list: one list, two doors
--
-- The marketing site's Saturday pop-up form (/fitness/saturday, and the
-- flyer QR) writes to the same library_subscribers list as the Trailhead
-- signup, tagged so a send can go to one door or to everyone. Existing rows
-- and the Trailhead form stay 'trailhead'; the pop-up form writes 'saturday'.
-- (WW Saturday Page Spec, schema commit, first part.)
--
-- Already applied to the live project on Oct 5 as
-- library_subscribers_source; this file brings the repo in line.
--
-- anon's table-level insert grant from ring 8 covers the new column, and
-- the existing policies are unchanged: anon may insert, never read, and only
-- the owner sees the list. A repeat email still hits the unique
-- (org_id, lower(email)) index, so a signup from either door is idempotent;
-- an email already on the list keeps its original source.
-- ============================================================

alter table library_subscribers
  add column if not exists source text not null default 'trailhead';

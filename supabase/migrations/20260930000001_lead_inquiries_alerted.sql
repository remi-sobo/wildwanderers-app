-- ============================================================
-- Wild Wanderers — Speed to lead, part 3: the new-inquiry alert stamp
--
-- The marketing route pings the app after an insert; the app emails the
-- org's owner and stamps alerted_at so an inquiry alerts once, even if two
-- pings race. Written only by the service role in the alert route.
--
-- anon's column grant from part 1 is unchanged, so a public insert can
-- never set alerted_at. Owner RLS from part 1 covers the column.
-- ============================================================

alter table lead_inquiries add column alerted_at timestamptz;

create index lead_inquiries_unalerted_idx on lead_inquiries (created_at)
  where alerted_at is null;

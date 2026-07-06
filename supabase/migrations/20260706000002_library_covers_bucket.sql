-- ============================================================
-- Ring 8: cover-image storage for the Trailhead Library
--
-- A public bucket for post cover images. Public because the marketing site
-- renders these anonymously; the objects carry no health or personal data,
-- only a picture Gabe chose for a post. Uploads happen server-side through the
-- admin chokepoint after an owner check (src/lib/library/actions.ts), the same
-- shape as the issue-report screenshot upload, so no storage.objects INSERT
-- policy is needed for the app role. Public read is the bucket's job.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('library-covers', 'library-covers', true)
on conflict (id) do nothing;

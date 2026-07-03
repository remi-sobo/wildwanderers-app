-- ============================================================
-- Team Esface — raise Film Room clip size limit to 2 GB
--
-- Phone 4K/60 and HDR footage runs well past 500 MB even for short
-- clips, so the byte ceiling has to cover the full allowed duration at
-- those bitrates. Paired with resumable (TUS) uploads on the client.
--
-- NOTE: the project-level global storage upload limit (Dashboard →
-- Storage → Settings → Upload file size limit) must also be >= 2 GB for
-- this to take effect. Supported on the Pro plan.
-- ============================================================

update storage.buckets
set file_size_limit = 2147483648 -- 2 GiB
where id = 'film-clips';

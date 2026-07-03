-- ============================================================
-- Wild Wanderers — Ring 3: voice check-ins (Deepgram)
--
-- A private Storage bucket for check-in audio. Body/voice data is
-- client-owned (CLAUDE.md health-data guardrails), so the bucket is
-- private and RLS scopes objects to the owning client. Path convention:
--   <client_id>/<uuid>.webm
-- The client uploads and reads their own audio through their session;
-- Gabe plays it back through a short-lived signed URL generated
-- server-side with the service role (which bypasses these policies).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('checkin-audio', 'checkin-audio', false)
on conflict (id) do nothing;

-- A client may upload audio only under their own client-id folder.
drop policy if exists "clients_upload_own_checkin_audio" on storage.objects;
create policy "clients_upload_own_checkin_audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'checkin-audio'
    and (storage.foldername(name))[1]::uuid = any (public.current_user_client_id())
  );

-- A client may read only their own audio.
drop policy if exists "clients_read_own_checkin_audio" on storage.objects;
create policy "clients_read_own_checkin_audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'checkin-audio'
    and (storage.foldername(name))[1]::uuid = any (public.current_user_client_id())
  );

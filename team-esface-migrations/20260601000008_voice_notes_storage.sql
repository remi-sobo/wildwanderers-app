-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase E · voice-notes storage bucket
--
-- Creates the private `voice-notes` bucket and scoped RLS
-- policies. Coaches upload to a path keyed on their own user
-- id ({auth.uid()}/{debrief_id}.webm) so the policies can
-- scope access by path prefix rather than a join.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes',
  'voice-notes',
  false,
  52428800,  -- 50 MB ceiling; a 3-min webm/opus is typically < 3 MB
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/webm;codecs=opus']
)
on conflict (id) do nothing;

-- Coaches can upload files into their own path-scoped folder.
create policy "coaches_upload_voice_notes"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-notes'
    and get_user_role() = 'coach'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coaches can read only their own voice notes.
create policy "coaches_read_own_voice_notes"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and get_user_role() = 'coach'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all voice notes (for moderation / support).
create policy "admins_read_all_voice_notes"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and get_user_role() = 'admin'
  );

-- ============================================================
-- Ring 8: the weekly Trailhead Library email
--
-- When Gabe sends a published post as the weekly note, it goes app-side through
-- Resend to members and to library_subscribers. Sending lives here in the app,
-- where the member list and the Resend key already are; the marketing site is
-- never involved. Real recipients only, no fabricated list.
--
-- Two small pieces of state:
--   * posts.email_sent_at: when the note last went out, so the composer can show
--     a sent state and a confirm before sending again.
--   * library_email_sends: one row per send, recording how many real recipients
--     it reached, for accountability. Owner-readable; written app-side through
--     the admin path.
-- ============================================================

alter table posts add column email_sent_at timestamptz;

create table library_email_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  post_id uuid references posts(id) on delete cascade not null,
  recipient_count int not null default 0,
  sent_by uuid references profiles(id),
  sent_at timestamptz not null default now()
);

create index library_email_sends_org_idx on library_email_sends (org_id, sent_at desc);
create index library_email_sends_post_idx on library_email_sends (post_id);

alter table library_email_sends enable row level security;

-- The owner reads their org's send history. Writes happen app-side through the
-- service-role admin client after an owner check, so no insert policy is needed
-- for the app roles.
create policy "owner_reads_email_sends"
  on library_email_sends for select
  to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner');

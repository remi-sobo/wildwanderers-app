-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase A · Migration 5 of 5 — notifications
--
-- A persisted, per-user notification store powering the in-app
-- notification bell (Phase F). This is distinct from the derived
-- "punch list" panel in src/lib/notifications/notifications.ts, which
-- computes action items on the fly from existing tables. This table
-- records discrete events (a DM arrived, a task was assigned, a
-- debrief is ready) that the fanout Edge Function writes.
--
-- Inserts are performed by the fanout-notifications Edge Function
-- using the service role (which bypasses RLS), so there is no insert
-- policy for regular users — a coach must not be able to forge a
-- notification for another user. Recipients can read and mark their
-- own notifications read.
-- ============================================================

create type notification_type as enum (
  'new_evaluation', 'review_session_scheduled',
  'plan_activated', 'assignment_created',
  'assignment_completed', 'direct_message',
  'feed_post', 'game_debrief', 'milestone_earned',
  'debrief_ready'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  recipient_id uuid references profiles(id) not null,
  type notification_type not null,
  title text not null,
  body text,
  data jsonb,                       -- { assignment_id, thread_id, feed_post_id, debrief_id, ... }
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index notifications_recipient_idx
  on notifications (recipient_id, is_read, created_at desc);

alter table notifications enable row level security;

-- Each user sees only their own notifications.
create policy "recipients_read_own_notifications"
  on notifications for select
  using (recipient_id = auth.uid());

-- Each user can mark their own notifications read. The WITH CHECK keeps
-- the row tied to them (they can't reassign it to someone else).
create policy "recipients_update_own_notifications"
  on notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Admins can read everything in their org (program-wide visibility).
create policy "admins_read_org_notifications"
  on notifications for select
  using (org_id = get_user_org() and get_user_role() = 'admin');

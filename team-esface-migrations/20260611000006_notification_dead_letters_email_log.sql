-- ============================================================
-- INSTRUMENTS (Phase 2) — notification dead letters + email log
-- ============================================================
-- Two gaps from the audit's backend findings:
--
--  * fanout-notifications had no dead-letter queue: a failed insert
--    batch meant parents silently never heard about their kid's
--    plan/evaluation. Failed batches now land here (written by the
--    Edge Function with the service role) so they're visible and
--    replayable.
--
--  * Email sends had no delivery record: the Resend stub returned
--    ok even when unconfigured, so production silently sent nothing.
--    Every send attempt is now logged with its outcome.
--
-- Both tables are sealed: RLS enabled with no policies, no direct
-- grants. The Edge Function bypasses RLS via service role; app code
-- writes email logs through the SECURITY DEFINER RPC below.

create table if not exists notification_dead_letters (
  id bigint generated always as identity primary key,
  org_id uuid,
  payload jsonb not null,
  error text not null,
  created_at timestamptz not null default now(),
  retried_at timestamptz
);

alter table notification_dead_letters enable row level security;
revoke all on table notification_dead_letters from public, anon, authenticated;

create table if not exists email_deliveries (
  id bigint generated always as identity primary key,
  sender_id uuid references profiles(id) on delete set null,
  recipient text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_deliveries_created_idx
  on email_deliveries (created_at desc);

alter table email_deliveries enable row level security;
revoke all on table email_deliveries from public, anon, authenticated;

-- App code logs sends through this so authenticated users can write
-- the log without holding table privileges. Sender is stamped from
-- auth.uid(), never trusted from the caller.
create or replace function public.log_email_delivery(
  p_recipient text,
  p_subject text,
  p_status text,
  p_error text default null,
  p_context jsonb default null
)
returns void
language sql
security definer
volatile
set search_path = pg_catalog, public
as $$
  insert into email_deliveries (sender_id, recipient, subject, status, error, context)
  values (auth.uid(), p_recipient, p_subject, p_status, p_error, p_context);
$$;

revoke execute on function public.log_email_delivery(text, text, text, text, jsonb) from public, anon;
grant  execute on function public.log_email_delivery(text, text, text, text, jsonb) to authenticated;

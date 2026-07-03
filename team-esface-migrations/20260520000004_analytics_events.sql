-- ============================================================
-- Analytics events — behavioral event log for /admin/analytics.
--
-- Already applied to the hosted DB via MCP. File is here so
-- local + remote agree.
-- ============================================================

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  actor_id uuid references profiles(id),
  actor_role user_role,
  event text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_org_created_idx
  on analytics_events (org_id, created_at desc);
create index analytics_events_event_created_idx
  on analytics_events (event, created_at desc);
create index analytics_events_actor_created_idx
  on analytics_events (actor_id, created_at desc);

alter table analytics_events enable row level security;

create policy "admins_read_org_analytics_events"
  on analytics_events for select
  using (org_id = get_user_org() and get_user_role() = 'admin');

create policy "authed_insert_own_analytics_events"
  on analytics_events for insert
  with check (
    (actor_id = auth.uid()) or (actor_id is null and event like 'share.%')
  );

create policy "anon_insert_share_analytics_events"
  on analytics_events for insert
  to anon
  with check (
    actor_id is null
    and event like 'share.%'
  );

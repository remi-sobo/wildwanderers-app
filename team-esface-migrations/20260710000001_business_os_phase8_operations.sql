-- ============================================================
-- Esface Business OS — Phase 8: Operations (Today's Moves)
--
-- The task board that runs the business day-to-day, expanded (per
-- Dele's direction) into a full Asana/Monday-style system: statuses
-- with in_progress, priorities, due dates, pin-to-today, manual
-- ordering, task comments, board + list views. Auto-generated tasks
-- from every other system keep it fed — nothing is double-entered.
--
-- Auto-generation, two mechanisms:
--   * REAL TRIGGERS where an event exists: camp completed → "Send camp
--     report cards" + "Complete coach reviews"; customer flagged
--     at_risk → "Retention check-in" for the family's coach-rep.
--   * LAZY SWEEP generate_business_tasks() for time-based rules (a
--     trigger cannot fire on the passage of time; the platform's
--     established pattern is the lazy sweep, like wishlist expiry):
--     - lead stale 7+ days → "Follow up with [family]" → its rep
--     - wishlist request unresolved 3+ days → nudge task → its rep
--       (the hook promised in Phase 4)
--     - staff document expiring within 30 days → renewal task (HR)
--     - payroll period past its end, still open/review → review task
--   Every generated task carries a dedupe_key: regenerating is free,
--   duplicates are impossible.
--
-- Honestly skipped: "season ending 45 days → re-enrollment push" —
-- teams carry a season LABEL ('2025-26') but no dates; there is
-- nothing to compute 45 days from. Revisit when seasons get dates.
-- ============================================================

create type task_category as enum
  ('sales', 'coaching', 'program', 'finance', 'hr',
   'camp', 'facilities', 'other');

create table business_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  title text not null,
  description text,
  category task_category default 'other',
  assignee_id uuid references staff_members(id),
  created_by uuid references profiles(id),
  priority text default 'medium' check (priority in
    ('urgent', 'high', 'medium', 'low')),
  due_date date,
  pin_today boolean default false,
  status text default 'open' check (status in
    ('open', 'in_progress', 'done', 'cancelled')),
  sort_order int default 0,
  -- auto-generation
  source_type text,                   -- 'lead_followup', 'wishlist_stale',
                                       -- 'doc_expiry', 'payroll_review',
                                       -- 'retention_risk', 'camp_end'
  source_id uuid,
  dedupe_key text unique,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index business_tasks_org_status_idx on business_tasks (org_id, status, pin_today);
create index business_tasks_assignee_idx on business_tasks (assignee_id, status);
create index business_tasks_due_idx on business_tasks (org_id, due_date)
  where status in ('open', 'in_progress');

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references business_tasks(id) on delete cascade not null,
  author_id uuid references profiles(id) not null,
  content text not null,
  created_at timestamptz default now()
);

create index task_comments_task_idx on task_comments (task_id, created_at);

alter table business_tasks enable row level security;
alter table task_comments  enable row level security;

-- ============================================================
-- RLS — ops.tasks.view_own / view_all / assign
-- ============================================================

create policy "tasks_view_all"
  on business_tasks for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.view_all')
  );

-- "Own" = assigned to me, or created by me (I can track what I filed).
create policy "tasks_view_own"
  on business_tasks for select
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.view_own')
    and (assignee_id = my_staff_member_id() or created_by = (select auth.uid()))
  );

-- Any tasks-capable staff can create; without ops.tasks.assign the task
-- must land on themselves or unassigned.
create policy "tasks_insert"
  on business_tasks for insert
  with check (
    org_id = get_user_org()
    and (
      has_business_permission((select auth.uid()), 'ops.tasks.assign')
      or (
        has_business_permission((select auth.uid()), 'ops.tasks.view_own')
        and (assignee_id is null or assignee_id = my_staff_member_id())
      )
    )
  );

-- Assignees work their tasks (status, pin, order); the WITH CHECK pins
-- assignment so a rep cannot hand a task off without ops.tasks.assign.
create policy "tasks_update_own"
  on business_tasks for update
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.view_own')
    and (assignee_id = my_staff_member_id() or created_by = (select auth.uid()))
  )
  with check (
    org_id = get_user_org()
    and (assignee_id is null
         or assignee_id = my_staff_member_id()
         or created_by = (select auth.uid()))
  );

create policy "tasks_update_assign"
  on business_tasks for update
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.assign')
  )
  with check (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.assign')
  );

create policy "tasks_delete_assign"
  on business_tasks for delete
  using (
    org_id = get_user_org()
    and has_business_permission((select auth.uid()), 'ops.tasks.assign')
  );

-- Comments ride the task's visibility (subquery runs under caller RLS).
create policy "task_comments_select"
  on task_comments for select
  using (task_id in (select id from business_tasks));

create policy "task_comments_insert"
  on task_comments for insert
  with check (
    task_id in (select id from business_tasks)
    and author_id = (select auth.uid())
  );

-- ============================================================
-- EVENT TRIGGERS
-- ============================================================

/** Camp completes → the two wrap-up tasks, once. */
create or replace function public.create_tasks_on_camp_end()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  insert into public.business_tasks
    (org_id, title, category, priority, due_date, source_type, source_id, dedupe_key)
  values
    (new.org_id, 'Send camp report cards — ' || new.name, 'camp', 'high',
     current_date + 3, 'camp_end', new.id, 'camp_reports:' || new.id),
    (new.org_id, 'Complete coach reviews — ' || new.name, 'camp', 'high',
     current_date + 7, 'camp_end', new.id, 'camp_reviews:' || new.id)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger camps_create_wrapup_tasks
  after update on camps
  for each row execute function public.create_tasks_on_camp_end();

/** Family flagged at_risk → retention check-in for their coach-rep. */
create or replace function public.create_task_on_retention_risk()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rep uuid;
begin
  if new.retention_risk <> 'at_risk' or old.retention_risk = 'at_risk' then
    return new;
  end if;

  -- The family's coach-rep: head coach (with a staff row) of any
  -- active athlete's current team in this family.
  select sm.id into v_rep
  from public.athletes a
  join public.teams t on t.id = a.current_team_id
  join public.staff_members sm on sm.profile_id = t.head_coach_id and sm.is_active
  where a.customer_id = new.id
  limit 1;

  insert into public.business_tasks
    (org_id, title, category, priority, due_date, assignee_id,
     source_type, source_id, dedupe_key)
  values
    (new.org_id, 'Retention check-in: ' || new.family_name || ' family',
     'sales', 'urgent', current_date + 2, v_rep,
     'retention_risk', new.id, 'retention:' || new.id)
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger customers_create_retention_task
  after update on customers
  for each row execute function public.create_task_on_retention_risk();

-- ============================================================
-- THE LAZY SWEEP — time-based task generation
-- ============================================================

/**
 * Generate time-based tasks for the caller's org. Called by the tasks
 * page on load (the platform's lazy-sweep pattern — no cron needed).
 * Idempotent via dedupe keys; requires a tasks permission.
 */
create or replace function public.generate_business_tasks()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_hr uuid;
begin
  if not (public.has_business_permission(auth.uid(), 'ops.tasks.view_own')
          or public.has_business_permission(auth.uid(), 'ops.tasks.view_all')) then
    raise exception 'TASKS_FORBIDDEN' using errcode = '42501';
  end if;
  select org_id into v_org from public.profiles where id = auth.uid();

  -- Lead stale 7+ days → follow-up for its rep.
  insert into public.business_tasks
    (org_id, title, category, priority, due_date, assignee_id,
     source_type, source_id, dedupe_key)
  select l.org_id,
         'Follow up with ' || l.parent_name, 'sales', 'high',
         current_date + 1, l.assigned_to, 'lead_followup', l.id,
         'lead_stale:' || l.id || ':' || to_char(l.updated_at, 'YYYY-MM-DD')
  from public.leads l
  where l.org_id = v_org
    and l.stage in ('new', 'contacted', 'engaged', 'trial_booked', 'proposal_sent')
    and l.updated_at < now() - interval '7 days'
  on conflict (dedupe_key) do nothing;

  -- Wishlist request unresolved 3+ days → nudge the rep (Phase-4 hook).
  insert into public.business_tasks
    (org_id, title, category, priority, due_date, assignee_id,
     source_type, source_id, dedupe_key)
  select r.org_id,
         'Nudge on wishlist: ' || r.item_name, 'sales', 'high',
         current_date + 1, l.assigned_to, 'wishlist_stale', r.id,
         'wishlist_stale:' || r.id
  from public.wishlist_requests r
  left join public.leads l on l.id = r.lead_id
  where r.org_id = v_org
    and r.status in ('requested', 'seen')
    and r.created_at < now() - interval '3 days'
  on conflict (dedupe_key) do nothing;

  -- Staff document expiring within 30 days → renewal task for HR-manage
  -- staff (unassigned if none — the board surfaces it).
  select sm.id into v_hr
  from public.staff_members sm
  join public.staff_permissions sp on sp.staff_member_id = sm.id
  join public.permission_sets ps on ps.id = sp.permission_set_id
  where sm.org_id = v_org and sm.is_active
    and 'hr.staff.manage' = any (ps.permissions)
  limit 1;

  insert into public.business_tasks
    (org_id, title, category, priority, due_date, assignee_id,
     source_type, source_id, dedupe_key)
  select v_org,
         'Renew "' || d.name || '" for ' || pr.first_name || ' ' || pr.last_name,
         'hr', 'high', d.expires_at, v_hr, 'doc_expiry', d.id,
         'doc_expiry:' || d.id
  from public.staff_documents d
  join public.staff_members sm on sm.id = d.staff_member_id and sm.org_id = v_org
  join public.profiles pr on pr.id = sm.profile_id
  where d.expires_at is not null
    and d.expires_at <= current_date + 30
  on conflict (dedupe_key) do nothing;

  -- Payroll period past its end, still open/review → review task.
  insert into public.business_tasks
    (org_id, title, category, priority, due_date,
     source_type, source_id, dedupe_key)
  select p.org_id,
         'Review payroll ' || p.period, 'finance', 'urgent',
         p.end_date + 3, 'payroll_review', p.id,
         'payroll_review:' || p.id
  from public.payroll_periods p
  where p.org_id = v_org
    and p.status in ('open', 'review')
    and p.end_date < current_date
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.create_tasks_on_camp_end()
  from public, anon, authenticated;
revoke execute on function public.create_task_on_retention_risk()
  from public, anon, authenticated;
revoke execute on function public.generate_business_tasks() from public, anon;
grant  execute on function public.generate_business_tasks() to authenticated, service_role;

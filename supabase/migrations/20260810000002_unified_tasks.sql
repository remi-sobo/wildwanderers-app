-- ============================================================
-- Wild Wanderers — Unified tasks, part 1 (additive)
--
-- One task system for the whole app (specs/unified-tasks.md). Tasks link
-- to leads, clients, customers, and the boys program, carry an assignee,
-- a next-step flag, recurrence, and auto-generation provenance, plus a
-- comment thread. Access widens from owner-only to staff: the owner sees
-- all, a coach sees assigned-or-created, clients and families see nothing.
--
-- This migration is purely additive so it can apply ahead of the code
-- deploy. The destructive half (converting leads.next_action into
-- next-step tasks and dropping the columns) is the next migration,
-- applied together with the deploy.
-- ============================================================

create type task_recur as enum ('none', 'daily', 'weekly', 'biweekly', 'monthly');

alter table business_tasks
  add column client_id   uuid references clients(id)   on delete set null,
  add column customer_id uuid references customers(id) on delete set null,
  add column program_id  uuid references programs(id)  on delete set null,
  add column assigned_to uuid references profiles(id),
  add column is_next_step boolean not null default false,
  add column recur task_recur not null default 'none',
  add column source_type text,
  add column dedupe_key text,
  add column updated_at timestamptz not null default now();

-- One open next step per lead, enforced here so a race splits loudly.
create unique index business_tasks_next_step_uniq on business_tasks (lead_id)
  where is_next_step and status in ('open', 'in_progress');
-- Auto-generation idempotency.
create unique index business_tasks_dedupe_uniq on business_tasks (dedupe_key)
  where dedupe_key is not null;
create index business_tasks_client_idx   on business_tasks (client_id)   where client_id is not null;
create index business_tasks_customer_idx on business_tasks (customer_id) where customer_id is not null;
create index business_tasks_program_idx  on business_tasks (program_id)  where program_id is not null;
create index business_tasks_assigned_idx on business_tasks (org_id, assigned_to);

-- ── task_comments ──────────────────────────────────────────
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  task_id uuid references business_tasks(id) on delete cascade not null,
  content text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on task_comments (task_id, created_at);
alter table task_comments enable row level security;

-- ── RLS: staff access ──────────────────────────────────────
-- The owner policy from Ring 4 stays as is (owner manages everything in
-- the org). A coach reaches only tasks assigned to them or created by
-- them; that is also the ceiling on what they can write.
create policy "coach_own_tasks" on business_tasks for all
  using (
    org_id = get_user_org() and get_user_role() = 'coach'
    and (assigned_to = auth.uid() or created_by = auth.uid())
  )
  with check (
    org_id = get_user_org() and get_user_role() = 'coach'
    and (assigned_to = auth.uid() or created_by = auth.uid())
  );

-- Comments ride the task's visibility: the subquery runs under the
-- caller's own task policies, so a coach reads and writes comments only
-- on tasks they can see.
create policy "staff_comments_via_task" on task_comments for all
  using (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from business_tasks t where t.id = task_id)
  )
  with check (
    org_id = get_user_org() and get_user_role() in ('owner', 'coach')
    and exists (select 1 from business_tasks t where t.id = task_id)
  );

-- ── Recurrence: completing an occurrence spawns the next ───
-- Fires only on the transition into done, spawns exactly one open row,
-- and the spawned row carries recur so the chain continues one step at a
-- time. Never a next-step task; the next step is set by a human.
create or replace function spawn_recurring_task()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'done' and old.status is distinct from new.status and new.recur <> 'none' then
    insert into business_tasks
      (org_id, title, description, category, priority, due_date, status,
       lead_id, client_id, customer_id, program_id, assigned_to, created_by,
       recur, is_next_step, pin_today)
    values
      (new.org_id, new.title, new.description, new.category, new.priority,
       (coalesce(new.due_date, current_date) + case new.recur
          when 'daily' then interval '1 day'
          when 'weekly' then interval '7 days'
          when 'biweekly' then interval '14 days'
          else interval '1 month'
        end)::date,
       'open', new.lead_id, new.client_id, new.customer_id, new.program_id,
       new.assigned_to, new.created_by, new.recur, false, false);
  end if;
  return new;
end;
$$;
revoke all on function spawn_recurring_task() from public, anon, authenticated;

create trigger business_tasks_spawn_recurring
  after update on business_tasks
  for each row execute function spawn_recurring_task();

-- ── The lazy sweep (no cron exists; the /tasks page calls this) ─
-- Two rules, both dedupe-keyed and guarded so reloading never duplicates:
--   1. a working lead untouched 7+ days grows a follow-up task
--   2. a working lead with no open next step grows a "set the next step"
create or replace function generate_tasks()
returns int
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_count int := 0;
  v_ins int;
begin
  if get_user_role() not in ('owner', 'coach') then
    raise exception 'TASKS_FORBIDDEN' using errcode = '42501';
  end if;
  v_org := get_user_org();

  insert into business_tasks
    (org_id, title, category, priority, due_date, status, lead_id,
     assigned_to, created_by, source_type, dedupe_key)
  select l.org_id, 'Follow up with ' || l.name, 'sales', 'high', current_date,
    'open', l.id, l.created_by, l.created_by, 'lead_stale',
    'lead_stale:' || l.id || ':' || to_char(l.updated_at, 'YYYY-MM-DD')
  from leads l
  where l.org_id = v_org
    and l.stage in ('new', 'contacted', 'engaged', 'trial', 'proposal')
    and l.updated_at < now() - interval '7 days'
    and not exists (
      select 1 from business_tasks t
      where t.lead_id = l.id and t.source_type = 'lead_stale'
        and t.status in ('open', 'in_progress'))
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_ins = row_count;
  v_count := v_count + v_ins;

  insert into business_tasks
    (org_id, title, category, priority, due_date, status, lead_id,
     assigned_to, created_by, source_type, dedupe_key)
  select l.org_id, 'Set the next step for ' || l.name, 'sales', 'medium',
    current_date, 'open', l.id, l.created_by, l.created_by, 'next_step_missing',
    'next_step_missing:' || l.id || ':' || to_char(current_date, 'YYYY-MM-DD')
  from leads l
  where l.org_id = v_org
    and l.stage in ('new', 'contacted', 'engaged', 'trial', 'proposal')
    and not exists (
      select 1 from business_tasks t
      where t.lead_id = l.id and t.is_next_step
        and t.status in ('open', 'in_progress'))
    and not exists (
      select 1 from business_tasks t
      where t.lead_id = l.id and t.source_type = 'next_step_missing'
        and t.status in ('open', 'in_progress'))
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_ins = row_count;
  v_count := v_count + v_ins;

  return v_count;
end;
$$;
revoke all on function generate_tasks() from public, anon;
grant execute on function generate_tasks() to authenticated;

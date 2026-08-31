-- ============================================================
-- Wild Wanderers — Task programs, work buckets, client homework
--
-- Side one: the task system grows a program dimension (fitness, boys,
-- general) with work buckets inside each. Buckets are rows, not enum
-- values, so Gabe can add and rename his own without a migration.
-- business_tasks gains program and bucket_id; the old category column
-- stays untouched (no data loss), the UI stops using it.
--
-- Side two: client_homework, the coach-to-client homework loop. The
-- coach assigns, the client sees it, checks it done, and leaves a note.
-- Homework is not the training plan (Ring 1 stays what it is) and it is
-- for clients only.
-- ============================================================

create type task_program as enum ('fitness', 'boys', 'general');

-- ── task_buckets ───────────────────────────────────────────
create table task_buckets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program task_program not null,
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, program, slug)
);
create index task_buckets_org_idx on task_buckets (org_id, program, sort_order);
alter table task_buckets enable row level security;

-- Staff read the org's buckets (a coach needs the names to file a task);
-- the owner shapes them.
create policy "staff_read_buckets" on task_buckets for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "owner_manages_buckets" on task_buckets for all
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ── business_tasks grows the program dimension ─────────────
-- category stays as is; existing RLS (owner all, coach assigned-or-
-- created) already covers the new columns.
alter table business_tasks
  add column program task_program not null default 'general',
  add column bucket_id uuid references task_buckets(id) on delete set null;
create index business_tasks_bucket_idx on business_tasks (bucket_id)
  where bucket_id is not null;
create index business_tasks_program_open_idx on business_tasks (org_id, program)
  where status in ('open', 'in_progress');

-- A task hung on a lead files itself: boys-program leads under the boys
-- enrollment bucket, every other lead under fitness sales. Covers the
-- sweep, next-step tasks, and the lead drawer's quick add in one place.
-- Fires only when the caller left program at its default and no bucket
-- was chosen, so an explicit choice always wins.
create or replace function place_lead_task()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_interest lead_interest;
  v_slug text;
begin
  if new.lead_id is null or new.bucket_id is not null or new.program <> 'general' then
    return new;
  end if;
  select interest into v_interest from leads where id = new.lead_id;
  if v_interest = 'boys_program' then
    new.program := 'boys';
    v_slug := 'enrollment-families';
  else
    new.program := 'fitness';
    v_slug := 'sales-pipeline';
  end if;
  select id into new.bucket_id from task_buckets
  where org_id = new.org_id and program = new.program and slug = v_slug and is_active
  limit 1;
  return new;
end;
$$;
revoke all on function place_lead_task() from public, anon, authenticated;

create trigger business_tasks_place_lead
  before insert on business_tasks
  for each row execute function place_lead_task();

-- The recurrence spawn copies columns explicitly, so the next occurrence
-- must carry program and bucket_id or a repeating task would fall out of
-- its bucket on first completion. Same body as unified tasks, two columns
-- added.
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
       recur, is_next_step, pin_today, program, bucket_id)
    values
      (new.org_id, new.title, new.description, new.category, new.priority,
       (coalesce(new.due_date, current_date) + case new.recur
          when 'daily' then interval '1 day'
          when 'weekly' then interval '7 days'
          when 'biweekly' then interval '14 days'
          else interval '1 month'
        end)::date,
       'open', new.lead_id, new.client_id, new.customer_id, new.program_id,
       new.assigned_to, new.created_by, new.recur, false, false,
       new.program, new.bucket_id);
  end if;
  return new;
end;
$$;
revoke all on function spawn_recurring_task() from public, anon, authenticated;

-- ── client_homework ────────────────────────────────────────
-- The extra mile beside the plan: one-off, checkable, personal. The
-- completion note is the client's own words back; same handling
-- discipline as messages, no AI touches it.
create type homework_status as enum ('assigned', 'done');

create table client_homework (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  client_id uuid references clients(id) on delete cascade not null,
  title text not null,
  details_md text,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  due_date date,
  status homework_status not null default 'assigned',
  completed_at timestamptz,
  completion_note text,
  created_at timestamptz not null default now()
);
create index client_homework_client_idx on client_homework (client_id, status, due_date);
create index client_homework_org_idx on client_homework (org_id, status);
alter table client_homework enable row level security;

-- Coach and owner of the org: full read and write.
create policy "staff_manage_homework" on client_homework for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- The client: their own rows only. Select, and update gated below to
-- status, completed_at, and completion_note by the guard trigger, since
-- RLS decides rows, not columns.
create policy "client_reads_own_homework" on client_homework for select
  using (
    org_id = get_user_org() and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  );
create policy "client_updates_own_homework" on client_homework for update
  using (
    org_id = get_user_org() and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  )
  with check (
    org_id = get_user_org() and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  );

-- A client may flip status, stamp completed_at, and write their note.
-- Every other column is the coach's; a client write to one fails loudly.
create or replace function guard_client_homework_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if get_user_role() = 'client' then
    if new.org_id      is distinct from old.org_id
      or new.client_id   is distinct from old.client_id
      or new.title       is distinct from old.title
      or new.details_md  is distinct from old.details_md
      or new.assigned_by is distinct from old.assigned_by
      or new.assigned_at is distinct from old.assigned_at
      or new.due_date    is distinct from old.due_date
      or new.created_at  is distinct from old.created_at
    then
      raise exception 'HOMEWORK_FIELDS_LOCKED' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function guard_client_homework_update() from public, anon, authenticated;

create trigger client_homework_guard_update
  before update on client_homework
  for each row execute function guard_client_homework_update();

-- ============================================================
-- SEED — the buckets and the real work in front of Gabe, from the
-- six-month build. Nothing invented; he edits freely after. Org-scoped,
-- created by the org's owner, so a second org starts empty.
-- ============================================================

insert into task_buckets (org_id, program, name, slug, sort_order)
select o.id, b.program::task_program, b.name, b.slug, b.ord
from organizations o,
  (values
    ('fitness', 'Sales & pipeline',      'sales-pipeline',       0),
    ('fitness', 'Marketing & content',   'marketing-content',    1),
    ('fitness', 'Client delivery',       'client-delivery',      2),
    ('fitness', 'Retention & referrals', 'retention-referrals',  3),
    ('boys',    'Enrollment & families', 'enrollment-families',  0),
    ('boys',    'Compliance & safety',   'compliance-safety',    1),
    ('boys',    'Program & curriculum',  'program-curriculum',   2),
    ('boys',    'Parent communication',  'parent-communication', 3),
    ('boys',    'Mentors',               'mentors',              4),
    ('general', 'Money & admin',         'money-admin',          0),
    ('general', 'The owner',             'the-owner',            1)
  ) as b(program, name, slug, ord);

insert into business_tasks (org_id, title, program, bucket_id, sort_order, created_by, assigned_to)
select o.id, t.title, t.program::task_program, tb.id, t.ord, own.id, own.id
from organizations o
cross join lateral (
  select p.id from profiles p
  where p.org_id = o.id and p.role = 'owner'
  limit 1
) own
cross join (values
  -- Fitness · Sales & pipeline
  ('fitness', 'sales-pipeline', 'Make this week''s five asks and log each in the pipeline', 0),
  ('fitness', 'sales-pipeline', 'Work every lead''s next action due today', 1),
  ('fitness', 'sales-pipeline', 'Send the day-after home workout to the newest free-session prospect', 2),
  ('fitness', 'sales-pipeline', 'Practice the offer script out loud before the next consult', 3),
  ('fitness', 'sales-pipeline', 'Move stale proposals to nurture with the clean closer', 4),
  -- Fitness · Marketing & content
  ('fitness', 'marketing-content', 'Publish this week''s Trailhead note', 0),
  ('fitness', 'marketing-content', 'Post 3x this week (one workout, one why, one life)', 1),
  ('fitness', 'marketing-content', 'Draft next week''s posts in the project', 2),
  ('fitness', 'marketing-content', 'Send the weekly trail note email', 3),
  -- Fitness · Client delivery
  ('fitness', 'client-delivery', 'Build next week''s plans for every active client', 0),
  ('fitness', 'client-delivery', 'Schedule any client hitting the 8-week assessment mark', 1),
  ('fitness', 'client-delivery', 'Review this week''s client logs and reply to check-ins', 2),
  -- Fitness · Retention & referrals
  ('fitness', 'retention-referrals', 'Monthly check-in touch for each client on schedule', 0),
  ('fitness', 'retention-referrals', 'Make one scripted referral ask to a happy client', 1),
  ('fitness', 'retention-referrals', 'Finalize the welcome package contents', 2),
  ('fitness', 'retention-referrals', 'Prepare the next welcome moment for the newest client', 3),
  -- Boys Program · Enrollment & families
  ('boys', 'enrollment-families', 'Follow up every family lead with a next action set', 0),
  ('boys', 'enrollment-families', 'Schedule trail visits for interested families', 1),
  ('boys', 'enrollment-families', 'Send the parent guide after each conversation', 2),
  ('boys', 'enrollment-families', 'Confirm the fall launch date and put it everywhere', 3),
  ('boys', 'enrollment-families', 'Fill the cohort: track spots against 10', 4),
  -- Boys Program · Compliance & safety
  ('boys', 'compliance-safety', 'Call Palo Alto Open Space about the commercial use permit', 0),
  ('boys', 'compliance-safety', 'Get the waiver and enrollment packet professionally reviewed', 1),
  ('boys', 'compliance-safety', 'Confirm insurance coverage for youth outdoor programs', 2),
  ('boys', 'compliance-safety', 'Confirm CPR and first aid are current, calendar the renewal', 3),
  ('boys', 'compliance-safety', 'Confirm LLC standing and business banking separation', 4),
  -- Boys Program · Program & curriculum
  ('boys', 'program-curriculum', 'Write next week''s three session plans (one purpose each)', 0),
  ('boys', 'program-curriculum', 'Record the five animals in kid language', 1),
  ('boys', 'program-curriculum', 'Prep the gear and supplies list for launch week', 2),
  ('boys', 'program-curriculum', 'Map the first structured adventure (scavenger hunt) in advance', 3),
  -- Boys Program · Parent communication
  ('boys', 'parent-communication', 'Send the Friday Field Report', 0),
  ('boys', 'parent-communication', 'Draft the ask-your-Wanderer question for the week', 1),
  ('boys', 'parent-communication', 'Keep the spotlight rotation so every boy is named within the session', 2),
  ('boys', 'parent-communication', 'Fill the parent guide brackets (times, meeting point, practical answers)', 3),
  -- Boys Program · Mentors
  ('boys', 'mentors', 'Check in with Manuel on his preparation', 0),
  ('boys', 'mentors', 'Finalize the mentor onboarding checklist from the operations manual', 1),
  ('boys', 'mentors', 'Schedule the walking interview when he''s ready', 2),
  -- General · Money & admin
  ('general', 'money-admin', 'Update offerings to the locked prices ($1,650 pack)', 0),
  ('general', 'money-admin', 'Enter this week''s revenue and expenses', 1),
  ('general', 'money-admin', 'Open the Profit First accounts (month three)', 2),
  ('general', 'money-admin', 'Prepare for the monthly close', 3),
  -- General · The owner
  ('general', 'the-owner', 'Read this month''s book (E-Myth, month one)', 0),
  ('general', 'the-owner', 'Sunday 30-minute week design', 1),
  ('general', 'the-owner', 'Monthly family business meeting with Sarah, books open', 2)
) as t(program, slug, title, ord)
join task_buckets tb
  on tb.org_id = o.id
  and tb.program = t.program::task_program
  and tb.slug = t.slug;

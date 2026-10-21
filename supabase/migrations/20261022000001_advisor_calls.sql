-- ============================================================
-- Wild Wanderers — advisor calls: transcripts to reviewed actions
-- (specs/advisor-calls.md)
--
-- The advisor pastes a coaching-call transcript. Proposed items are
-- extracted (each with its source quote), reviewed, and only the items
-- the advisor accepts and sends become work: assignments or
-- suggestions in the owner's tasks, or the advisor's own private
-- to-dos. Decisions and notes stay on the call record.
--
-- Rules confirmed with the owner (2026-10-21):
--   * Transcripts are kept 90 days, then deleted. An expired transcript
--     is unreadable at once (RLS) and purged by purge_expired_calls(),
--     run on load and daily where pg_cron exists.
--   * Only the advisor can delete a call.
--   * The owner never reads a transcript or the proposals: there is no
--     owner policy on either table. The owner sees only the tasks the
--     advisor sends, which carry the action text and nothing else.
--
-- Sending is one transaction and idempotent: each sent item creates at
-- most one task (unique source_session_item_id) or one private to-do
-- (its id is the to-do's request_key), and an item already linked to
-- an existing task ("already in the app") creates nothing.
-- ============================================================

-- ── coaching_sessions: one row per call ───────────────────────
create table coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  advisor_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  held_on date not null default current_date,
  transcript text not null check (length(transcript) between 1 and 200000),
  status text not null default 'new' check (status in ('new', 'extracted', 'sent')),
  agenda text check (agenda is null or length(agenda) <= 10000),
  private_notes text check (private_notes is null or length(private_notes) <= 10000),
  request_key uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index coaching_sessions_advisor_idx on coaching_sessions (advisor_id, held_on desc);
create index coaching_sessions_expiry_idx on coaching_sessions (expires_at);

create trigger coaching_sessions_touch
  before update on coaching_sessions
  for each row execute function public.advisor_items_touch();

alter table coaching_sessions enable row level security;

-- The advisor's own calls, while unexpired. No owner, coach, client or
-- parent policy exists.
create policy "advisor_manages_own_calls" on coaching_sessions for all
  using (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and org_id = any (advisor_org_ids()) and expires_at > now()
  )
  with check (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and org_id = any (advisor_org_ids()) and expires_at > now()
  );

-- ── session_items: proposed, reviewed, sent ───────────────────
create table session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references coaching_sessions(id) on delete cascade,
  org_id uuid not null references organizations(id),
  advisor_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  -- Stable per call, so re-running extraction never doubles an item.
  item_key text not null check (length(item_key) between 1 and 200),
  section text not null check (section in ('owner', 'advisor', 'decided', 'note')),
  text text not null check (length(btrim(text)) between 1 and 1000),
  owner text not null default 'unclear' check (owner in ('owner', 'advisor', 'unclear')),
  due_date date,
  quote text check (quote is null or length(quote) <= 2000),
  quote_at text check (quote_at is null or length(quote_at) <= 40),
  flag text check (flag in ('already_in_app', 'possibly_done', 'needs_clarification', 'idea', 'goal')),
  match_task_id uuid references business_tasks(id) on delete set null,
  state text not null default 'proposed' check (state in ('proposed', 'accepted', 'removed', 'sent')),
  send_as text check (send_as in ('assignment', 'suggestion')),
  keep_private boolean not null default false,
  sent_task_id uuid references business_tasks(id) on delete set null,
  sent_item_id uuid references advisor_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_key)
);
create index session_items_session_idx on session_items (session_id, section);

create trigger session_items_touch
  before update on session_items
  for each row execute function public.advisor_items_touch();

alter table session_items enable row level security;

-- Items ride their call's visibility: the subquery runs under the
-- advisor's own call policy, expiry included.
create policy "advisor_manages_own_call_items" on session_items for all
  using (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and exists (select 1 from coaching_sessions s where s.id = session_id)
  )
  with check (
    advisor_id = auth.uid() and get_user_role() = 'advisor'
    and exists (select 1 from coaching_sessions s where s.id = session_id and s.org_id = session_items.org_id)
  );

-- ── business_tasks: which call item a task came from ──────────
alter table business_tasks
  add column source_session_item_id uuid references session_items(id) on delete set null;
create unique index business_tasks_source_item_uniq on business_tasks (source_session_item_id)
  where source_session_item_id is not null;

-- ── Send: accepted items become work, once ────────────────────
create or replace function public.advisor_send_call(p_session_id uuid)
returns table (sent_tasks int, saved_todos int, kept_on_record int, held_back int)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.coaching_sessions%rowtype;
  v_owner uuid;
  v_item public.session_items%rowtype;
  v_task uuid;
  v_todo uuid;
  n_tasks int := 0;
  n_todos int := 0;
  n_record int := 0;
  n_held int := 0;
begin
  if get_user_role() is distinct from 'advisor' then
    raise exception 'ADVISOR_FORBIDDEN' using errcode = '42501';
  end if;

  -- Lock the call so two sends at once cannot interleave.
  select * into v_session from public.coaching_sessions s
  where s.id = p_session_id and s.advisor_id = auth.uid()
    and s.expires_at > now() and s.org_id = any (advisor_org_ids())
  for update;
  if not found then
    raise exception 'ADVISOR_FORBIDDEN' using errcode = '42501';
  end if;

  select p.id into v_owner from public.profiles p
  where p.org_id = v_session.org_id and p.role = 'owner'
  order by p.created_at limit 1;
  if v_owner is null then
    raise exception 'ADVISOR_NO_OWNER' using errcode = '23503';
  end if;

  for v_item in
    select * from public.session_items i
    where i.session_id = v_session.id and i.state = 'accepted'
    order by i.created_at
  loop
    if v_item.section = 'owner' and v_item.owner = 'unclear' then
      -- Nothing goes to the owner while it is unclear whose it is.
      n_held := n_held + 1;
      continue;
    elsif v_item.match_task_id is not null then
      -- Already in the app: link it, never duplicate it.
      update public.session_items set state = 'sent', sent_task_id = v_item.match_task_id where id = v_item.id;
      n_record := n_record + 1;
    elsif v_item.section = 'owner' and v_item.owner = 'owner' and not v_item.keep_private then
      if v_item.send_as is null then
        n_held := n_held + 1;
        continue;
      end if;
      insert into public.business_tasks (
        org_id, title, due_date, kind, assigned_by, assigned_to, created_by,
        program, category, priority, source_type, source_session_item_id
      ) values (
        v_session.org_id, btrim(v_item.text), v_item.due_date, v_item.send_as, auth.uid(), v_owner, auth.uid(),
        'general', 'other', 'medium', 'advisor_call', v_item.id
      )
      on conflict (source_session_item_id) where source_session_item_id is not null do nothing
      returning id into v_task;
      if v_task is null then
        select t.id into v_task from public.business_tasks t where t.source_session_item_id = v_item.id;
      end if;
      update public.session_items set state = 'sent', sent_task_id = v_task where id = v_item.id;
      n_tasks := n_tasks + 1;
    elsif v_item.section in ('owner', 'advisor') then
      -- The advisor's own, or kept private: a private to-do, once.
      insert into public.advisor_items (org_id, advisor_id, kind, vis, title, due_date, request_key)
      values (v_session.org_id, auth.uid(), 'todo', 'private', left(btrim(v_item.text), 300), v_item.due_date, v_item.id)
      on conflict (request_key) do nothing
      returning id into v_todo;
      if v_todo is null then
        select a.id into v_todo from public.advisor_items a where a.request_key = v_item.id;
      end if;
      update public.session_items set state = 'sent', sent_item_id = v_todo where id = v_item.id;
      n_todos := n_todos + 1;
    else
      -- Decisions and notes stay on the call record.
      update public.session_items set state = 'sent' where id = v_item.id;
      n_record := n_record + 1;
    end if;
    v_task := null;
    v_todo := null;
  end loop;

  if n_held = 0 then
    update public.coaching_sessions set status = 'sent' where id = v_session.id;
  end if;

  return query select n_tasks, n_todos, n_record, n_held;
end;
$$;
revoke execute on function public.advisor_send_call(uuid) from public, anon;
grant execute on function public.advisor_send_call(uuid) to authenticated;

-- ── Retention: expired calls are deleted ──────────────────────
-- Deletes only calls past their 90 days; safe for anyone to trigger.
-- Tasks made from a call keep existing (their link is set null).
create or replace function public.purge_expired_calls()
returns int
language sql security definer
set search_path = pg_catalog, public
as $$
  with gone as (
    delete from public.coaching_sessions where expires_at <= now() returning 1
  )
  select count(*)::int from gone
$$;
revoke execute on function public.purge_expired_calls() from public, anon;
grant execute on function public.purge_expired_calls() to authenticated;

-- Daily purge where pg_cron is available (Supabase); skipped elsewhere.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-expired-advisor-calls', '17 9 * * *', 'select public.purge_expired_calls()');
  end if;
end;
$$;

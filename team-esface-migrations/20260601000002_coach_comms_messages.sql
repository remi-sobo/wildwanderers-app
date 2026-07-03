-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase A · Migration 2 of 5 — direct messages
--
--   message_threads — one row per (coach, athlete) conversation.
--   messages        — individual messages within a thread.
--
-- In V1 only the coach sends. Parents and athletes are read-only
-- recipients; read receipts let the coach see whether a message was
-- seen. Marking-as-read is done through a SECURITY DEFINER function so
-- recipients never need write access to the messages table.
-- ============================================================

-- ─── SECURITY DEFINER helpers (mirror rls_recursion_helpers pattern) ──
-- The current user's athlete row + that athlete's current team. Owned
-- by postgres (BYPASSRLS) so policies that call them don't re-enter
-- another table's RLS and risk a recursion cycle.

create or replace function public.current_user_athlete_id()
returns uuid
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select id from public.athletes where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_athlete_team_id()
returns uuid
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select current_team_id from public.athletes where user_id = auth.uid() limit 1;
$$;

revoke execute on function public.current_user_athlete_id()      from public, anon;
revoke execute on function public.current_user_athlete_team_id() from public, anon;
grant  execute on function public.current_user_athlete_id()      to authenticated;
grant  execute on function public.current_user_athlete_team_id() to authenticated;

-- ─── Enum ─────────────────────────────────────────────────────────

create type message_recipient_type as enum ('athlete', 'parent', 'both');

-- ─── Tables ───────────────────────────────────────────────────────

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  coach_id uuid references profiles(id) not null,
  athlete_id uuid references athletes(id) not null,
  recipient_type message_recipient_type default 'both',
  last_message_at timestamptz default now(),
  last_message_preview text,
  created_at timestamptz default now(),
  unique (coach_id, athlete_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  thread_id uuid references message_threads(id) not null,
  sender_id uuid references profiles(id) not null,
  sender_role user_role not null,
  content text not null,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index messages_thread_id_idx on messages (thread_id, created_at);
create index message_threads_coach_id_idx on message_threads (coach_id, last_message_at desc);
create index message_threads_athlete_id_idx on message_threads (athlete_id);

-- ─── Thread roll-up trigger ───────────────────────────────────────
-- Keep last_message_at / last_message_preview current as messages land,
-- so the thread list renders without an extra aggregate query.

create or replace function public.touch_message_thread()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  update public.message_threads
     set last_message_at = new.created_at,
         last_message_preview = left(new.content, 140)
   where id = new.thread_id;
  return new;
end;
$$;

create trigger messages_touch_thread
  after insert on messages
  for each row execute function public.touch_message_thread();

-- Trigger function only — never meant to be called directly via the
-- REST RPC surface. Revoke the implicit execute grant.
revoke execute on function public.touch_message_thread() from public, anon, authenticated;

-- ─── Mark-as-read (recipient-safe, no write grant needed) ─────────
-- Marks every message in the thread NOT sent by the caller as read.
-- Verifies the caller is a legitimate participant first.

create or replace function public.mark_thread_messages_read(p_thread_id uuid)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_participant boolean;
begin
  select exists (
    select 1
    from public.message_threads t
    where t.id = p_thread_id
      and (
        -- the coach who owns the thread
        t.coach_id = v_uid
        -- the athlete on the thread
        or t.athlete_id = (select id from public.athletes where user_id = v_uid limit 1)
        -- a parent linked to the athlete on the thread
        or exists (
          select 1 from public.parent_athletes pa
          where pa.athlete_id = t.athlete_id and pa.parent_id = v_uid
        )
      )
  ) into v_is_participant;

  if not v_is_participant then
    raise exception 'not a participant in thread %', p_thread_id;
  end if;

  update public.messages
     set is_read = true,
         read_at = coalesce(read_at, now())
   where thread_id = p_thread_id
     and sender_id <> v_uid
     and is_read = false;
end;
$$;

revoke execute on function public.mark_thread_messages_read(uuid) from public, anon;
grant  execute on function public.mark_thread_messages_read(uuid) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────

alter table message_threads enable row level security;
alter table messages        enable row level security;

-- message_threads ─────────────────────────────────────────────────

create policy "admins_full_access_message_threads"
  on message_threads for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_own_message_threads"
  on message_threads for all
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and coach_id = auth.uid()
  );

create policy "parents_read_child_message_threads"
  on message_threads for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and recipient_type in ('parent', 'both')
    and athlete_id = any (current_user_child_athlete_ids())
  );

create policy "athletes_read_own_message_threads"
  on message_threads for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and recipient_type in ('athlete', 'both')
    and athlete_id = current_user_athlete_id()
  );

-- messages ────────────────────────────────────────────────────────
-- Reads/writes are scoped through thread visibility. A message is
-- visible when its parent thread is visible (the thread policies above
-- already enforce role + recipient_type), so the message policies just
-- defer to `thread_id in (select id from message_threads ...)`.

create policy "admins_full_access_messages"
  on messages for all
  using (org_id = get_user_org() and get_user_role() = 'admin')
  with check (org_id = get_user_org() and get_user_role() = 'admin');

create policy "coaches_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and sender_id = auth.uid()
    and thread_id in (select id from message_threads where coach_id = auth.uid())
  );

create policy "coaches_read_own_messages"
  on messages for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and thread_id in (select id from message_threads where coach_id = auth.uid())
  );

create policy "recipients_read_messages"
  on messages for select
  using (
    get_user_role() in ('parent', 'athlete')
    and thread_id in (select id from message_threads)
  );

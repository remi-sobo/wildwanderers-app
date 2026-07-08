-- ============================================================
-- Wild Wanderers — Ring 13.8: open messaging
--
-- A conversation can now begin from either side, and families join.
-- The thread's far end generalizes: a client OR a guardian, exactly
-- one, still one-to-one with one staff member. Never member to member
-- (the tenancy guardrail); the recipient a member can pick is staff,
-- through a directory helper that exposes exactly a first name and a
-- role, nothing more.
--
-- Two deliberate steps past the Team Esface fork, which kept thread
-- creation coach-only even after two-way replies (20260702000002):
-- clients and guardians can now CREATE their thread with a staff
-- member. Compensating controls, both fork patterns: sender identity
-- stays pinned on every message insert, and the create policies allow
-- exactly the caller's own far end and a staff coach_id.
-- ============================================================

-- ── The far end: a client or a guardian, exactly one ─────────
alter table message_threads
  alter column client_id drop not null;

alter table message_threads
  add column if not exists guardian_id uuid references guardians(id) on delete cascade;

alter table message_threads
  add constraint message_threads_one_far_end
  check (num_nonnulls(client_id, guardian_id) = 1);

-- One thread per staff-and-family pair (the client pair is already
-- unique; NULLs keep it out of each other's way).
create unique index if not exists message_threads_coach_guardian_key
  on message_threads (coach_id, guardian_id) where guardian_id is not null;

-- ── Helpers ──────────────────────────────────────────────────
-- The org's staff, by first name and role only: everything a member
-- ever sees of the directory. Mirrors the definer-helper pattern the
-- messaging fork already leans on.
create or replace function public.org_staff_directory()
returns table (id uuid, first_name text, role user_role)
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select p.id, coalesce(nullif(trim(p.first_name), ''), 'Coach'), p.role
  from public.profiles p
  where p.org_id = public.get_user_org()
    and p.role in ('owner', 'coach');
$$;
revoke execute on function public.org_staff_directory() from public, anon;
grant  execute on function public.org_staff_directory() to authenticated;

-- The caller's guardian rows (a family login), mirroring
-- current_user_client_id().
create or replace function public.current_user_guardian_ids()
returns uuid[]
language sql security definer stable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from public.guardians where user_id = auth.uid();
$$;
revoke execute on function public.current_user_guardian_ids() from public, anon;
grant  execute on function public.current_user_guardian_ids() to authenticated;

-- ── Threads: members start their own ─────────────────────────
create policy "clients_create_message_threads"
  on message_threads for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
    and guardian_id is null
    and coach_id in (select d.id from org_staff_directory() d)
  );

create policy "guardians_read_own_message_threads"
  on message_threads for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and guardian_id = any (current_user_guardian_ids())
  );

create policy "guardians_create_message_threads"
  on message_threads for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and guardian_id = any (current_user_guardian_ids())
    and client_id is null
    and coach_id in (select d.id from org_staff_directory() d)
  );

-- ── Messages: the family lane, sender pinned ─────────────────
create policy "guardians_send_messages"
  on messages for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and sender_id = (select auth.uid())
    and sender_role = 'parent'
    and thread_id in (
      select id from message_threads
      where guardian_id = any (current_user_guardian_ids())
    )
  );

create policy "guardians_read_messages"
  on messages for select
  using (
    get_user_role() = 'parent'
    and thread_id in (select id from message_threads)
  );

-- ── Read receipts reach the family lane too ──────────────────
create or replace function public.mark_thread_messages_read(p_thread_id uuid)
returns void
language plpgsql security definer volatile
set search_path = pg_catalog, public
as $$
declare
  is_participant boolean;
begin
  select exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id
      and (
        t.coach_id = auth.uid()
        or t.client_id = any (public.current_user_client_id())
        or t.guardian_id = any (public.current_user_guardian_ids())
      )
  ) into is_participant;

  if not is_participant then
    raise exception 'not a participant of this thread';
  end if;

  update public.messages
    set is_read = true, read_at = coalesce(read_at, now())
  where thread_id = p_thread_id
    and sender_id <> auth.uid()
    and is_read = false;
end;
$$;
revoke execute on function public.mark_thread_messages_read(uuid) from public, anon;
grant  execute on function public.mark_thread_messages_read(uuid) to authenticated;

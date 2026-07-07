-- ============================================================
-- Wild Wanderers — Ring 10: Coach accountability ("Alongside")
--
-- Clients share to Gabe; nothing let him share back. This closes the loop: a
-- short honest weekly note from the coach, optionally with a photo and a line on
-- what he moved, that clients and families see, and can send a wordless "walking
-- with you" acknowledgement to. Three pieces, forking the Ring 8 Trailhead
-- shapes near-verbatim:
--   * coach_shares       — the note. Staff compose and publish; members read.
--   * coach_share_acks   — one wordless ack per person per share. Its count is
--                          denormalized onto coach_shares.ack_count by a trigger,
--                          so a member reads the true count without reading any
--                          identity, exactly the post_challenge_completions path.
--   * coach-media bucket — public Storage for a share photo, same reasoning and
--                          same server-side chokepoint as library-covers.
--
-- RLS from the first migration, on the Ring 0 helpers get_user_org(),
-- get_user_role(). A share carries no client health data; the guardrails here
-- are voice and tenancy. Seeds ONE clearly-labeled sample Gabe replaces; we
-- never write his voice for him.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
-- A light tone chip so a win reads like a win and a hard week reads as human.
create type coach_share_tone as enum ('note', 'training', 'lesson', 'win', 'tough_day');
-- everyone = clients and families; clients = fitness clients only.
create type coach_share_audience as enum ('everyone', 'clients');
create type coach_share_status as enum ('draft', 'published');

-- ── coach_shares ───────────────────────────────────────────
create table coach_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  author_id uuid references profiles(id),
  tone coach_share_tone not null default 'note',
  title text,
  body text not null,
  training_note text,
  media_url text,
  audience coach_share_audience not null default 'everyone',
  status coach_share_status not null default 'draft',
  published_at timestamptz,
  ack_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A share must actually say something.
  constraint coach_shares_has_body check (nullif(btrim(body), '') is not null)
);

create index coach_shares_org_status_idx on coach_shares (org_id, status, published_at desc);
create index coach_shares_author_idx on coach_shares (author_id);

-- ── coach_share_acks ───────────────────────────────────────
-- One row per person per share. profile_id is the auth user (profiles.id =
-- auth.users.id), so a client or a parent may ack, each exactly once.
create table coach_share_acks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  share_id uuid references coach_shares(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (share_id, profile_id)
);

create index coach_share_acks_share_idx on coach_share_acks (share_id);
create index coach_share_acks_profile_idx on coach_share_acks (profile_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table coach_shares     enable row level security;
alter table coach_share_acks enable row level security;

-- ── coach_shares ───────────────────────────────────────────
-- Staff (owner+coach) compose, edit, and see drafts within their org.
create policy "staff_manage_coach_shares"
  on coach_shares for all
  to authenticated
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- Members read published shares in their org. A client sees any audience; a
-- family (parent) sees only the everyone tier, never a clients-only note.
create policy "members_read_published_coach_shares"
  on coach_shares for select
  to authenticated
  using (
    status = 'published'
    and org_id = get_user_org()
    and (
      get_user_role() = 'client'
      or (get_user_role() = 'parent' and audience = 'everyone')
    )
  );

-- ── coach_share_acks ───────────────────────────────────────
-- A client or family writes and reads only their own ack, and only on a share
-- they are allowed to see (the subselect rides the read policy above).
create policy "member_manages_own_ack"
  on coach_share_acks for all
  to authenticated
  using (
    org_id = get_user_org()
    and get_user_role() in ('client', 'parent')
    and profile_id = auth.uid()
  )
  with check (
    org_id = get_user_org()
    and get_user_role() in ('client', 'parent')
    and profile_id = auth.uid()
    and exists (select 1 from coach_shares s where s.id = share_id and s.status = 'published')
  );

-- The author's side reads every ack on the org's shares, for the true count.
create policy "staff_read_coach_share_acks"
  on coach_share_acks for select
  to authenticated
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ── ack_count sync (denormalized, definer) ─────────────────
-- A member inserting their own ack cannot UPDATE coach_shares (staff-only), so
-- the counter update runs with definer rights. Not an RPC; execute is revoked.
create or replace function public.sync_coach_share_ack_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    update public.coach_shares set ack_count = ack_count + 1 where id = new.share_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.coach_shares set ack_count = greatest(0, ack_count - 1) where id = old.share_id;
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_coach_share_ack_count() from public, anon, authenticated;

create trigger coach_share_ack_count_sync
  after insert or delete on coach_share_acks
  for each row execute function public.sync_coach_share_ack_count();

-- ── coach-media bucket ─────────────────────────────────────
-- Public read (a trail photo carries no client data). Uploads are staff-minted
-- server-side through the admin chokepoint, so no storage.objects policy here.
insert into storage.buckets (id, name, public)
values ('coach-media', 'coach-media', true)
on conflict (id) do nothing;

-- ============================================================
-- SEED — one clearly-labeled sample share
-- Published so the loop is visible end to end; copy says plainly it is a sample
-- to replace or delete. We never ship invented coach voice as real.
-- ============================================================
insert into coach_shares (org_id, author_id, tone, title, body, audience, status, published_at)
select
  o.id,
  null,
  'note',
  'A sample note',
  'This is a sample so you can see how a weekly note looks. Replace it or delete it anytime. A real note goes here: what the week held, what I am working on, an honest word. We are in this together, and I am learning right alongside you.',
  'everyone',
  'published',
  now()
from public.organizations o
where o.slug = 'wild-wanderers-fitness'
on conflict do nothing;

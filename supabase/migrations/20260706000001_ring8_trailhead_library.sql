-- ============================================================
-- Wild Wanderers — Ring 8: the Trailhead Library
--
-- Gabe's living content engine. The app writes, the marketing site reads,
-- from this one shared Supabase. Three tables:
--   * posts — the content. Gabe composes and publishes from the owner app.
--   * post_challenge_completions — a client marks the weekly challenge done.
--   * library_subscribers — a public email-capture list for the weekly note.
--
-- The relationship is one-way. The marketing site holds only the anon key
-- and never writes content; it reads published, public posts and inserts a
-- subscriber email through the narrow anon policies below. Everything else
-- is owner-only, behind the same org + role RLS as the rest of the app,
-- driven by the Ring 0 helpers get_user_org(), get_user_role(), and
-- current_user_client_id().
--
-- Anon reach is deliberately tiny and self-consistent with RLS:
--   * anon may SELECT posts only where status='published' AND audience='public'.
--   * anon may INSERT one subscriber row, bound to an org that actually has a
--     public library (a subselect anon is itself allowed to read). No SELECT,
--     so the list is never readable by the public. No new anon-callable
--     SECURITY DEFINER function, so we do not reopen the advisor finding the
--     Ring 0 helpers closed.
--
-- Seeds ONE clearly-labeled sample post (public, published) so Gabe can see
-- the surface everywhere at once and delete it in a tap. Labeled as a sample,
-- never passed off as real editorial content, the same honesty as the Ring 7
-- form placeholders. No other content is seeded.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
-- The fixed category set. New categories are a migration, not free text.
create type post_category as enum (
  'podcasts',
  'fitness_updates',
  'assessment_breakdowns',
  'child_development_and_play',
  'camping_and_the_outdoors',
  'research_and_field_notes'
);
create type post_audience as enum ('public', 'members');
create type post_status as enum ('draft', 'published');

-- ── posts ──────────────────────────────────────────────────
create table posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  author_id uuid references profiles(id),
  title text not null,
  -- Unique per org so the same slug can exist in a second coach's library.
  slug text not null,
  category post_category not null,
  -- A post is a link, a short body, or both. At least one is enforced below.
  external_link text,
  body text,
  cover_image_url text,
  -- Defaults to public so member-only is always a deliberate choice.
  audience post_audience not null default 'public',
  status post_status not null default 'draft',
  published_at timestamptz,
  is_challenge boolean not null default false,
  challenge_week int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug),
  -- A post must carry something to show.
  constraint posts_has_content check (
    external_link is not null or nullif(btrim(body), '') is not null
  ),
  -- A challenge names its week; a non-challenge does not.
  constraint posts_challenge_week check (
    (is_challenge and challenge_week is not null)
    or (not is_challenge and challenge_week is null)
  )
);

create index posts_org_status_idx on posts (org_id, status, published_at desc);
create index posts_org_category_idx on posts (org_id, category);
create index posts_org_challenge_idx on posts (org_id, is_challenge, challenge_week);
create index posts_author_idx on posts (author_id);

-- ── post_challenge_completions ─────────────────────────────
-- One row per client per challenge post. The count of these is the real,
-- never-fabricated "how many finished it" number on both surfaces.
create table post_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  post_id uuid references posts(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  completed_at timestamptz not null default now(),
  unique (post_id, client_id)
);

create index post_completions_post_idx on post_challenge_completions (post_id);
create index post_completions_client_idx on post_challenge_completions (client_id);

-- ── library_subscribers ────────────────────────────────────
-- The public "get the weekly trail note" list. Written by the anon role from
-- the marketing signup, read only by the owner. Unique per org per email so a
-- repeat signup is idempotent, not a duplicate send.
create table library_subscribers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Unique per org per lowercased email so a repeat signup is idempotent. A
-- lowercased-expression key must be a unique index, not a table constraint.
create unique index library_subscribers_org_email_idx
  on library_subscribers (org_id, lower(email));
create index library_subscribers_org_idx on library_subscribers (org_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table posts                     enable row level security;
alter table post_challenge_completions enable row level security;
alter table library_subscribers       enable row level security;

-- ── posts ──────────────────────────────────────────────────
-- Public read: anyone, signed in or not, sees published public posts.
create policy "anyone_reads_published_public_posts"
  on posts for select
  to anon, authenticated
  using (status = 'published' and audience = 'public');

-- Members read: a signed-in client of the org also sees published member posts.
create policy "members_read_published_member_posts"
  on posts for select
  to authenticated
  using (
    status = 'published'
    and audience = 'members'
    and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach', 'client')
  );

-- Owner is the only writer, and the only one who sees drafts.
create policy "owner_manages_posts"
  on posts for all
  to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ── post_challenge_completions ─────────────────────────────
-- A client writes and reads only their own completion.
create policy "client_manages_own_completion"
  on post_challenge_completions for all
  to authenticated
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  )
  with check (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and client_id = any (current_user_client_id())
  );

-- The owner reads every completion in the org, for the real count.
create policy "owner_reads_org_completions"
  on post_challenge_completions for select
  to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner');

-- ── library_subscribers ────────────────────────────────────
-- Anon (the public signup) may INSERT one email, bound to an org that already
-- has a published public library, a subselect anon is itself allowed to read.
-- No SELECT policy for anon, so the list is never publicly readable.
create policy "anon_signs_up_for_library"
  on library_subscribers for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from posts p
      where p.org_id = library_subscribers.org_id
        and p.status = 'published'
        and p.audience = 'public'
    )
  );

-- The owner reads and manages the org's subscriber list.
create policy "owner_manages_subscribers"
  on library_subscribers for all
  to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ── Table grants ───────────────────────────────────────────
-- RLS is the boundary; grants just open the door the policies then guard.
-- anon gets read on posts and insert on subscribers, nothing more.
grant select on posts to anon;
grant insert on library_subscribers to anon;

-- ============================================================
-- SEED — one clearly-labeled sample post
-- Public and published so it appears in the app feed, the marketing grid, and
-- a weekly send at once. The copy says plainly it is a sample to replace or
-- delete; we never ship invented content as real. Idempotent on (org_id, slug).
-- ============================================================
insert into posts (org_id, author_id, title, slug, category, body, audience, status, published_at)
select
  o.id,
  null,
  'What goes in the Trailhead Library?',
  'sample-what-goes-in-the-trailhead-library',
  'research_and_field_notes',
  'This is a sample post so we can see how a trail note looks in the app and on the site. Replace it or delete it anytime. Real notes go here: a short thought, a link to a podcast, or a field observation from a morning at the Baylands.',
  'public',
  'published',
  now()
from public.organizations o
where o.slug = 'wild-wanderers-fitness'
on conflict (org_id, slug) do nothing;

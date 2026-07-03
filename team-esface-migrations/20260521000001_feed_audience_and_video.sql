-- ============================================================
-- Team Esface — Feed posts: audience targeting + video URL
--
-- Adds two columns to feed_posts:
--   audience_roles  text[]  — empty array = visible to all roles in
--                             scope; otherwise filter to listed roles
--                             ('coach' | 'parent' | 'athlete')
--   video_url       text    — optional YouTube / Vimeo / Loom link
--                             rendered inline by the post card
--
-- The reader policies update so that when audience_roles is set, only
-- the listed roles see the post. Empty array preserves today's
-- behavior so existing posts stay visible to everyone.
-- ============================================================

alter table feed_posts
  add column audience_roles text[] not null default '{}'::text[];

alter table feed_posts
  add column video_url text;

-- Constrain audience_roles to the three audience-facing user roles.
-- Admin/HQ never receives posts (they author them), so it's not a
-- valid audience target.
alter table feed_posts
  add constraint feed_posts_audience_roles_valid
  check (audience_roles <@ array['coach','parent','athlete']::text[]);

create index feed_posts_audience_roles_idx
  on feed_posts using gin (audience_roles);

-- Helper: true when a post is visible to the given role under the
-- audience_roles column. Empty array means "no role filter applied"
-- (the default, matches pre-migration behavior).
create or replace function feed_post_visible_to_role(roles text[], target text)
returns boolean
language sql
immutable
as $$
  select coalesce(array_length(roles, 1), 0) = 0
      or target = any(roles);
$$;

-- Replace the three reader policies so they also honor the audience
-- role filter. The write policies and the admin all-access policy
-- aren't affected — they don't read audience_roles.
drop policy if exists "coaches_read_feed_posts" on feed_posts;
drop policy if exists "parents_read_feed_posts" on feed_posts;
drop policy if exists "athletes_read_feed_posts" on feed_posts;

create policy "coaches_read_feed_posts"
  on feed_posts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and feed_post_visible_to_role(audience_roles, 'coach')
    and (
      team_id is null
      or team_id in (select team_id from coach_teams where coach_id = auth.uid())
    )
  );

create policy "parents_read_feed_posts"
  on feed_posts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'parent'
    and feed_post_visible_to_role(audience_roles, 'parent')
    and (
      team_id is null
      or team_id in (
        select a.current_team_id
        from athletes a
        join parent_athletes pa on pa.athlete_id = a.id
        where pa.parent_id = auth.uid()
      )
    )
  );

create policy "athletes_read_feed_posts"
  on feed_posts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'athlete'
    and feed_post_visible_to_role(audience_roles, 'athlete')
    and (
      team_id is null
      or team_id in (
        select current_team_id
        from athletes
        where user_id = auth.uid()
      )
    )
  );

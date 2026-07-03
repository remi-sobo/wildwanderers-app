-- ============================================================
-- Team Esface — Coach Communication & Assignment System
-- Phase A · Migration 1 of 5 — feed_posts: coach authorship
--
-- Extends feed_posts so a coach (not just HQ) can author a post and
-- so a post can carry the three new coach-driven post types. The new
-- enum values are added here, isolated from any statement that uses
-- them as a literal (Postgres forbids using a freshly-added enum value
-- in the same transaction that adds it).
--
--   author_role     'admin' | 'coach' — who wrote the post
--   coach_id        the authoring coach (null for HQ posts)
--   game_debrief_id set when the post was published from a debrief.
--                   Intentionally unconstrained (the debriefs table is
--                   created in a later migration and the link is a soft
--                   reference, matching the feature spec).
-- ============================================================

alter type feed_post_type add value if not exists 'coach_post';
alter type feed_post_type add value if not exists 'game_debrief';
alter type feed_post_type add value if not exists 'task_assignment_shoutout';

alter table feed_posts
  add column author_role text not null default 'admin'
    check (author_role in ('admin', 'coach')),
  add column coach_id uuid references profiles(id),
  add column game_debrief_id uuid;

create index feed_posts_coach_id_idx on feed_posts (coach_id);

-- A coach authoring a post tags it with their own id. Extend the
-- existing coach write policy so the coach_id, when present, must be
-- the authenticated coach. The original policy (coaches_write_team_feed_posts)
-- already constrains team_id to a team they coach; we replace it so the
-- author columns are validated too.
drop policy if exists "coaches_write_team_feed_posts" on feed_posts;
create policy "coaches_write_team_feed_posts"
  on feed_posts for insert
  with check (
    org_id = get_user_org()
    and get_user_role() = 'coach'
    and team_id is not null
    and team_id in (select team_id from coach_teams where coach_id = auth.uid())
    and (coach_id is null or coach_id = auth.uid())
  );

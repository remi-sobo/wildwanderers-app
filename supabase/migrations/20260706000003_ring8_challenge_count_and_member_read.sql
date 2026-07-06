-- ============================================================
-- Ring 8: challenge completion count + family member-read
--
-- Two changes the reader surface needs:
--
-- 1) A real "how many finished the challenge" number that everyone allowed to
--    see the post can read, without reading anyone's identity. A client may
--    read only their OWN completion by RLS, so a client cannot tally the rest.
--    We denormalize the tally onto posts.completion_count and keep it in sync
--    with a trigger. It rides the existing post read policies, so the app
--    reader AND the anon marketing site show the same true count, with no
--    privileged read and no identities exposed.
--
-- 2) Member posts are for signed-in members, and families (the parent role)
--    are members too, not just fitness clients. Broaden the member-read policy
--    to include parent so the shared reader shows member posts to families.
-- ============================================================

-- ── 1) completion_count on posts ───────────────────────────
alter table posts add column completion_count int not null default 0;

-- Kept in sync by a SECURITY DEFINER trigger: a client inserting their own
-- completion cannot UPDATE posts (owner-only writes), so the counter update
-- must run with definer rights. Not callable as an RPC; execute is revoked.
create or replace function public.sync_post_completion_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set completion_count = completion_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set completion_count = greatest(0, completion_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_post_completion_count() from public, anon, authenticated;

create trigger post_completion_count_sync
  after insert or delete on post_challenge_completions
  for each row execute function public.sync_post_completion_count();

-- ── 2) families read member posts too ──────────────────────
drop policy "members_read_published_member_posts" on posts;
create policy "members_read_published_member_posts"
  on posts for select
  to authenticated
  using (
    status = 'published'
    and audience = 'members'
    and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach', 'client', 'parent')
  );

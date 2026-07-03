-- ============================================================
-- Wild Wanderers — Ring 0 seed helpers
--
-- Accounts are created by signing up (the on_auth_user_created trigger
-- from the foundation migration writes a profile row, role 'client',
-- org null). This script then places those accounts in the Wild
-- Wanderers Fitness org: it promotes the owner and marks the first
-- client. It stores no passwords and never touches auth.users, so it
-- is safe to commit and re-run.
--
-- Replace the two emails below, then run against the project. Both
-- statements are idempotent.
-- ============================================================

-- 1. Promote the owner (Gabe): role owner, in the Wild Wanderers org.
update public.profiles p
set role = 'owner',
    org_id = o.id,
    updated_at = now()
from public.organizations o
where o.slug = 'wild-wanderers-fitness'
  and p.id = (select id from auth.users where email = 'OWNER_EMAIL_HERE');

-- 2. Attach a client to the org and create their client record. Clearly
--    a real, named client, never a fabricated one.
with ww as (
  select id from public.organizations where slug = 'wild-wanderers-fitness'
),
u as (
  select id from auth.users where email = 'CLIENT_EMAIL_HERE'
),
promoted as (
  update public.profiles p
  set role = 'client', org_id = (select id from ww), updated_at = now()
  where p.id = (select id from u)
  returning p.id
)
insert into public.clients (org_id, user_id, first_name, last_name, status)
select (select id from ww), (select id from u), 'FIRST_NAME', 'LAST_NAME', 'active'
where (select id from u) is not null
  and not exists (
    select 1 from public.clients c where c.user_id = (select id from u)
  );

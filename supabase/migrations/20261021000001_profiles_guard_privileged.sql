-- ============================================================
-- Wild Wanderers — profiles: guard role and org_id
--
-- The ring0 policy "users_update_own_profile" lets a signed-in user
-- update their own row, and nothing limits which columns. As written,
-- a user could set their own role to 'owner' and point org_id at any
-- org straight through the public API. RLS cannot restrict columns,
-- so a trigger holds the line.
--
-- Rule: when role or org_id changes on a request made as the
-- 'authenticated' (or 'anon') database role, it must be the org's
-- owner changing someone else's role inside their own org. Moving a
-- profile between orgs, or changing your own role, is refused.
-- The service role (server-side admin client: invite a coach, attach
-- a client or parent login) and migrations run as other database
-- roles and pass, so every existing write path keeps working.
--
-- Deliberately SECURITY INVOKER: current_user must be the caller's
-- database role. get_user_role() and get_user_org() are already
-- definer helpers, so the reads below work for any caller.
-- ============================================================

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.role is not distinct from old.role
     and new.org_id is not distinct from old.org_id then
    return new;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.id <> auth.uid()
     and old.org_id is not null
     and new.org_id is not distinct from old.org_id
     and get_user_org() = old.org_id
     and get_user_role() = 'owner' then
    return new;
  end if;

  raise exception 'PROFILE_PRIVILEGED_COLUMNS' using errcode = '42501';
end;
$$;
revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;

create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function public.guard_profile_privileged_columns();

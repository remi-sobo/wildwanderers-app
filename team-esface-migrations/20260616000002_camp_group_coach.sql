-- ============================================================
-- Team Esface — Group coach as a first-class field
-- Camp Module · Ops
--
-- A camp group (a "team" within the week) HAS a coach. Storing it on
-- the group makes mid-camp reassignment a single edit:
--   * change a player's coach  → move the camper to another group
--   * change a group's coach    → set camp_groups.coach_id
--
-- camp_coaches stays the camp staff list (it drives camp scope + which
-- camp a coach sees). Whenever a group's coach is set, the app also
-- ensures that coach has a camp_coaches row so their access lights up.
--
-- get_camper_coach now resolves: the camper's group coach first, then a
-- camp-wide lead coach as a fallback.
-- ============================================================

alter table camp_groups
  add column if not exists coach_id uuid references profiles(id);

create index if not exists camp_groups_coach_idx on camp_groups (coach_id);

create or replace function public.get_camper_coach(p_camper_id uuid)
returns table (coach_id uuid, first_name text, last_name text)
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  v_camp_id uuid;
  v_coach   uuid;
  v_allowed boolean;
begin
  select camp_id into v_camp_id from public.campers where id = p_camper_id;
  if v_camp_id is null then
    return;
  end if;

  select (
    p_camper_id = any (public.current_user_camper_ids())
    or v_camp_id = any (public.current_user_coach_camp_ids())
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  ) into v_allowed;
  if not v_allowed then
    return;
  end if;

  -- Prefer the camper's group coach.
  select g.coach_id into v_coach
  from public.campers c
  join public.camp_groups g on g.id = c.group_id
  where c.id = p_camper_id;

  -- Fall back to a camp-wide lead coach.
  if v_coach is null then
    select cc.coach_id into v_coach
    from public.camp_coaches cc
    where cc.camp_id = v_camp_id
    order by case when cc.role = 'lead' then 0 else 1 end, cc.created_at
    limit 1;
  end if;

  if v_coach is null then
    return;
  end if;

  return query
    select pr.id, pr.first_name, pr.last_name
    from public.profiles pr
    where pr.id = v_coach;
end;
$$;

revoke execute on function public.get_camper_coach(uuid) from public, anon;
grant  execute on function public.get_camper_coach(uuid) to authenticated;

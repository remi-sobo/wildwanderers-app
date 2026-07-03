-- ============================================================
-- Team Esface — Camp groups, family invites, group-aware coach
-- Camp Module · Ops
--
-- Builds on 20260615000001. Adds:
--   * campers.invited_at — when the family login invite was sent, so HQ
--     can see who's been invited vs. who has claimed a login (user_id).
--   * get_camper_coach() becomes GROUP-AWARE: a camper's coach is the
--     coach assigned to their group (lead preferred), falling back to a
--     camp-wide coach. Reassigning a camper's group — or a group's coach
--     — instantly changes who their coach is, which happens constantly
--     mid-camp.
--
-- camp_groups / campers.group_id / camp_coaches.group_id already exist
-- from the foundation migration, so no new tables are needed.
-- ============================================================

alter table campers add column if not exists invited_at timestamptz;

create or replace function public.get_camper_coach(p_camper_id uuid)
returns table (coach_id uuid, first_name text, last_name text)
language plpgsql security definer stable
set search_path = pg_catalog, public
as $$
declare
  v_camp_id  uuid;
  v_group_id uuid;
  v_allowed  boolean;
begin
  select camp_id, group_id into v_camp_id, v_group_id
  from public.campers where id = p_camper_id;
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

  return query
    select cc.coach_id, p.first_name, p.last_name
    from public.camp_coaches cc
    join public.profiles p on p.id = cc.coach_id
    where cc.camp_id = v_camp_id
      and (cc.group_id is null or cc.group_id = v_group_id)
    order by
      -- the camper's own group coach wins over a camp-wide coach
      case when v_group_id is not null and cc.group_id = v_group_id then 0 else 1 end,
      case when cc.role = 'lead' then 0 else 1 end,
      cc.created_at
    limit 1;
end;
$$;

revoke execute on function public.get_camper_coach(uuid) from public, anon;
grant  execute on function public.get_camper_coach(uuid) to authenticated;

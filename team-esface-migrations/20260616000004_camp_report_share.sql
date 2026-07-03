-- ============================================================
-- Team Esface — Camp report-card sharing
-- Camp Module · Phase 6
--
-- Families can share their camper's report card via an unguessable
-- link, the same way the season summary shares. The 32-hex token is the
-- access control; it expires so a stale link stops resolving.
--
--   campers.share_token            — null until the family generates one
--   campers.share_token_expires_at — link validity window
--   get_camp_report_by_token(text) — public (anon) read of the report
-- ============================================================

alter table campers
  add column if not exists share_token text,
  add column if not exists share_token_expires_at timestamptz;

create unique index if not exists campers_share_token_idx
  on campers (share_token)
  where share_token is not null;

-- Assemble the public report payload for a valid, unexpired token.
-- SECURITY DEFINER so it reads past RLS; the token is the gate.
create or replace function public.get_camp_report_by_token(token text)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'first_name', c.first_name,
    'last_name',  c.last_name,
    'grade',      c.grade,
    'evaluation', (
      select to_jsonb(ev)
      from public.camp_evaluations ev
      where ev.camper_id = c.id and ev.status = 'completed'
      limit 1
    ),
    'catalog', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', d.id, 'name', d.name,
                           'description', d.description, 'icon_name', d.icon_name)
        order by d.sort_order)
      from public.camp_milestone_definitions d
      where d.org_id = c.org_id and d.is_active
    ), '[]'::jsonb),
    'earned_ids', coalesce((
      select jsonb_agg(cm.definition_id)
      from public.camper_milestones cm
      where cm.camper_id = c.id
    ), '[]'::jsonb)
  )
  from public.campers c
  where c.share_token = token
    and c.share_token_expires_at is not null
    and c.share_token_expires_at > now()
  limit 1;
$$;

revoke execute on function public.get_camp_report_by_token(text) from public;
grant  execute on function public.get_camp_report_by_token(text) to anon, authenticated;

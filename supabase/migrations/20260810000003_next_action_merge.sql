-- ============================================================
-- Wild Wanderers — Unified tasks, part 2 (the next-action merge)
--
-- DESTRUCTIVE: applied together with the code deploy, after part 1.
-- Every open lead's next action becomes its open next-step task, the
-- counts are verified in the same transaction, and only then do the two
-- lead columns drop. Closed leads' stale next-action text is not
-- migrated; their history lives in lead_activities.
-- ============================================================

do $$
declare
  v_src int;
  v_ins int;
begin
  select count(*) into v_src
  from leads
  where stage not in ('won', 'lost')
    and (coalesce(btrim(next_action), '') <> '' or next_action_date is not null);

  insert into business_tasks
    (org_id, title, category, priority, due_date, status, lead_id,
     is_next_step, created_by)
  select l.org_id,
    coalesce(nullif(btrim(l.next_action), ''), 'Follow up'),
    'sales', 'medium', l.next_action_date, 'open', l.id, true, l.created_by
  from leads l
  where l.stage not in ('won', 'lost')
    and (coalesce(btrim(l.next_action), '') <> '' or l.next_action_date is not null);

  get diagnostics v_ins = row_count;
  if v_ins <> v_src then
    raise exception 'next_action merge mismatch: % source leads, % tasks created', v_src, v_ins;
  end if;
end;
$$;

-- The partial index leads_next_action_idx drops with its column.
alter table leads
  drop column next_action,
  drop column next_action_date;

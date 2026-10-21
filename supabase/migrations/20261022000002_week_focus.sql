-- ============================================================
-- Wild Wanderers — My three and This Week's Five (specs/week.md)
--
-- Two small pointer tables over the one task system. Neither stores a
-- task: each row points at a business_tasks row, so checking a task off
-- anywhere checks it off here too.
--
--   day_focus   up to three tasks a person picked for one local day.
--               Not pin_today: pins keep their meaning and ordering.
--   week_plans  up to five tasks for one week, keyed by its Monday.
--
-- Caps live in the schema (position 1 to 3, 1 to 5, unique per day or
-- week), so no write path can exceed them. set_day_focus() and
-- set_week_five() replace a day's or week's picks in one transaction.
-- They run as the caller (security invoker), so RLS decides every row
-- and a person can only point at tasks they can already see.
-- ============================================================

create table day_focus (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  on_date date not null,
  task_id uuid not null references business_tasks(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (profile_id, on_date, task_id),
  unique (profile_id, on_date, position)
);
create index day_focus_lookup_idx on day_focus (profile_id, on_date);

create table week_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  task_id uuid not null references business_tasks(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  created_at timestamptz not null default now(),
  unique (profile_id, week_start, task_id),
  unique (profile_id, week_start, position)
);
create index week_plans_lookup_idx on week_plans (profile_id, week_start);

alter table day_focus  enable row level security;
alter table week_plans enable row level security;

-- Staff manage their own picks, and only over tasks they can see (the
-- subquery runs under the caller's task policies). Nobody else reads
-- them: no client, parent, advisor or other staff policy.
create policy "staff_own_day_focus" on day_focus for all
  using (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
  )
  with check (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
    and exists (select 1 from business_tasks t where t.id = task_id)
  );

create policy "staff_own_week_plans" on week_plans for all
  using (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
  )
  with check (
    profile_id = auth.uid() and org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
    and exists (select 1 from business_tasks t where t.id = task_id)
  );

-- Replace a day's three in one go. Order of p_task_ids is the order.
create or replace function public.set_day_focus(p_date date, p_task_ids uuid[])
returns void
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  i int;
begin
  if coalesce(array_length(p_task_ids, 1), 0) > 3 then
    raise exception 'FOCUS_TOO_MANY' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_task_ids, '{}')) x) <> coalesce(array_length(p_task_ids, 1), 0) then
    raise exception 'FOCUS_DUPLICATE' using errcode = '22023';
  end if;
  delete from public.day_focus where profile_id = auth.uid() and on_date = p_date;
  for i in 1 .. coalesce(array_length(p_task_ids, 1), 0) loop
    insert into public.day_focus (org_id, profile_id, on_date, task_id, position)
    values (v_org, auth.uid(), p_date, p_task_ids[i], i);
  end loop;
end;
$$;
revoke execute on function public.set_day_focus(date, uuid[]) from public, anon;
grant execute on function public.set_day_focus(date, uuid[]) to authenticated;

-- Replace a week's five in one go. p_week must be a Monday.
create or replace function public.set_week_five(p_week date, p_task_ids uuid[])
returns void
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := get_user_org();
  i int;
begin
  if coalesce(array_length(p_task_ids, 1), 0) > 5 then
    raise exception 'FIVE_TOO_MANY' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_task_ids, '{}')) x) <> coalesce(array_length(p_task_ids, 1), 0) then
    raise exception 'FIVE_DUPLICATE' using errcode = '22023';
  end if;
  delete from public.week_plans where profile_id = auth.uid() and week_start = p_week;
  for i in 1 .. coalesce(array_length(p_task_ids, 1), 0) loop
    insert into public.week_plans (org_id, profile_id, week_start, task_id, position)
    values (v_org, auth.uid(), p_week, p_task_ids[i], i);
  end loop;
end;
$$;
revoke execute on function public.set_week_five(date, uuid[]) from public, anon;
grant execute on function public.set_week_five(date, uuid[]) to authenticated;

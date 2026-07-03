-- ============================================================
-- Esface Business OS — Phase 6: Payroll
--
-- The Phase-1 shell (payroll_periods, payroll_lines) comes alive:
-- each period assembles every active staff member's line from data
-- the platform already tracks, finance reviews and adjusts, the
-- period is approved and paid, and paying it stamps the grouped
-- commissions paid. Export to CSV for whatever processor Esface uses
-- (automated payout via Gusto/Stripe Connect = V2, per the spec).
--
-- HONEST ADAPTATION — what "sessions delivered" means today. The spec
-- counts session_logs; no such table exists. The coach work the
-- platform actually records is:
--   * completed evaluations authored by the coach (spec's own
--     "evaluations at the standard 1hr/team rate")
--   * completed review sessions held by the coach
--   * camp days coached (camp_coaches x the camp's dates overlapping
--     the period)
-- Those three sum into sessions_count. Pay math per comp_type:
--   * per_session → sessions_count x base_rate_cents
--   * salary      → base_rate_cents flat for the monthly period
--   * hourly      → 0 base (NO hours tracking exists yet — the
--     adjustments field is the honest correction channel; a real
--     availability/hours log is future work)
--   * commission  → commissions only
-- Bonuses default to 0 until HR reviews (Phase 7) define a bonus
-- source; the adjustments field covers one-offs meanwhile.
-- ============================================================

-- Lines are one-per-staff-per-period; the generator upserts on rerun.
create unique index if not exists payroll_lines_period_staff_uniq
  on payroll_lines (period_id, staff_member_id);

-- ============================================================
-- THE GENERATOR
-- ============================================================

/**
 * Create or refresh the payroll period for `p_period` ("2026-06").
 * Permission is checked INSIDE (finance.payroll.manage) because this
 * is SECURITY DEFINER and callable over RPC. Reruns are safe while the
 * period is still open/review: computed components refresh, manual
 * adjustments and notes survive. Approved/paid periods refuse.
 */
create or replace function public.generate_payroll_period(p_period text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_start date;
  v_end date;
  v_period_id uuid;
  v_status text;
  sm record;
  v_sessions int;
  v_commissions int;
  v_base int;
  v_sessions_amount int;
  v_total int;
begin
  if not public.has_business_permission(auth.uid(), 'finance.payroll.manage') then
    raise exception 'PAYROLL_FORBIDDEN' using errcode = '42501';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then
    raise exception 'PAYROLL_BAD_PERIOD' using errcode = 'P0001';
  end if;

  select org_id into v_org from public.profiles where id = auth.uid();
  v_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  select id, status into v_period_id, v_status
  from public.payroll_periods
  where org_id = v_org and period = p_period;

  if v_period_id is null then
    insert into public.payroll_periods (org_id, period, start_date, end_date, status)
    values (v_org, p_period, v_start, v_end, 'open')
    returning id into v_period_id;
  elsif v_status in ('approved', 'paid') then
    raise exception 'PAYROLL_LOCKED' using errcode = 'P0001';
  end if;

  for sm in
    select s.id, s.profile_id, s.comp_type, coalesce(s.base_rate_cents, 0) as rate
    from public.staff_members s
    where s.org_id = v_org and s.is_active
  loop
    -- Sessions delivered in the window, from real program data.
    select
      (select count(*) from public.evaluations e
        where e.coach_id = sm.profile_id and e.status = 'completed'
          and e.completed_at >= v_start and e.completed_at < v_end + 1)
      + (select count(*) from public.review_sessions rs
          where rs.coach_id = sm.profile_id and rs.status = 'completed'
            and rs.completed_at >= v_start and rs.completed_at < v_end + 1)
      + coalesce((
          select sum(
            greatest(0,
              least(coalesce(c.end_date, c.start_date), v_end)
              - greatest(c.start_date, v_start) + 1))::int
          from public.camp_coaches cc
          join public.camps c on c.id = cc.camp_id
          where cc.coach_id = sm.profile_id
            and c.start_date is not null
            and c.start_date <= v_end
            and coalesce(c.end_date, c.start_date) >= v_start
        ), 0)
    into v_sessions;

    select coalesce(sum(commission_amount_cents), 0) into v_commissions
    from public.commissions
    where staff_member_id = sm.id and period = p_period
      and status in ('approved', 'paid');

    v_base := case when sm.comp_type = 'salary' then sm.rate else 0 end;
    v_sessions_amount :=
      case when sm.comp_type = 'per_session' then v_sessions * sm.rate else 0 end;
    v_total := v_base + v_sessions_amount + v_commissions;

    insert into public.payroll_lines
      (period_id, staff_member_id, base_amount_cents, sessions_count,
       sessions_amount_cents, commissions_amount_cents, bonus_amount_cents,
       total_cents, status)
    values
      (v_period_id, sm.id, v_base, v_sessions,
       v_sessions_amount, v_commissions, 0, v_total, 'draft')
    on conflict (period_id, staff_member_id) do update
      set base_amount_cents = excluded.base_amount_cents,
          sessions_count = excluded.sessions_count,
          sessions_amount_cents = excluded.sessions_amount_cents,
          commissions_amount_cents = excluded.commissions_amount_cents,
          -- manual fields survive the refresh
          total_cents = excluded.base_amount_cents
            + excluded.sessions_amount_cents
            + excluded.commissions_amount_cents
            + payroll_lines.bonus_amount_cents
            + payroll_lines.adjustments_cents;
  end loop;

  update public.payroll_periods p
  set total_cents = (select coalesce(sum(l.total_cents), 0)
                     from public.payroll_lines l where l.period_id = p.id)
  where p.id = v_period_id;

  return v_period_id;
end;
$$;

revoke execute on function public.generate_payroll_period(text) from public, anon;
grant  execute on function public.generate_payroll_period(text) to authenticated, service_role;

-- ============================================================
-- KEEP TOTALS TRUE + PAY THE COMMISSIONS
-- ============================================================

/** Any line edit (adjustments, bonuses) re-totals the line + period. */
create or replace function public.recompute_payroll_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.total_cents := coalesce(new.base_amount_cents, 0)
    + coalesce(new.sessions_amount_cents, 0)
    + coalesce(new.commissions_amount_cents, 0)
    + coalesce(new.bonus_amount_cents, 0)
    + coalesce(new.adjustments_cents, 0);
  return new;
end;
$$;

create trigger payroll_lines_totals
  before update on payroll_lines
  for each row execute function public.recompute_payroll_totals();

create or replace function public.retotal_period_after_line()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.payroll_periods p
  set total_cents = (select coalesce(sum(l.total_cents), 0)
                     from public.payroll_lines l where l.period_id = p.id)
  where p.id = coalesce(new.period_id, old.period_id);
  return coalesce(new, old);
end;
$$;

create trigger payroll_lines_retotal_period
  after insert or update or delete on payroll_lines
  for each row execute function public.retotal_period_after_line();

/**
 * Period marked paid → the approved commissions grouped into it are
 * stamped paid. The rep's "pending → approved → paid" story completes.
 */
create or replace function public.pay_commissions_on_period_paid()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update public.commissions
    set status = 'paid', paid_at = now()
    where org_id = new.org_id and period = new.period and status = 'approved';
  end if;
  return new;
end;
$$;

create trigger payroll_periods_pay_commissions
  after update on payroll_periods
  for each row execute function public.pay_commissions_on_period_paid();

revoke execute on function public.recompute_payroll_totals()
  from public, anon, authenticated;
revoke execute on function public.retotal_period_after_line()
  from public, anon, authenticated;
revoke execute on function public.pay_commissions_on_period_paid()
  from public, anon, authenticated;

-- ============================================================
-- Wild Wanderers — Ring 6 follow-up: bands by coach judgment,
-- and the band stays the database's word, never the client's.
--
-- Two things, from the assessment spec's scoring model ("a band is set
-- against a simple target Gabe defines per test, or by his own judgment
-- on the day"):
--
-- 1. A coach-judgment flag on the catalog. A test flagged
--    use_coach_judgment carries no thresholds; the band on a result is
--    the coach's read on the day. Observed tests with no sensible
--    number (Overhead reach) finally get a band this way.
--
-- 2. The band trigger now also fires on updates of band itself. Before
--    this, the trigger fired only on value/assessment_id, so a client
--    could PATCH band directly on their own row (clients_manage_own_results
--    is FOR ALL) and hand themselves 'healthy'. Now every band write is
--    re-decided by the database: thresholds compute it when they can,
--    a staff-supplied band stands when they cannot, and a non-staff
--    band is cleared. A client still never sets their own band.
-- ============================================================

alter table assessments
  add column if not exists use_coach_judgment boolean not null default false;

-- Overhead reach is the observed, no-threshold test in the seed catalog:
-- coach's judgment on the day is exactly how it is banded. Body-composition
-- rows stay unflagged on purpose: no band there, just your own trend.
update assessments set use_coach_judgment = true
where slug = 'overhead_reach' and band_improving is null and band_healthy is null;

create or replace function public.compute_assessment_band()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_higher   boolean;
  v_imp      numeric;
  v_healthy  numeric;
  v_judgment boolean;
begin
  select higher_is_better, band_improving, band_healthy, use_coach_judgment
    into v_higher, v_imp, v_healthy, v_judgment
  from public.assessments where id = new.assessment_id;

  -- Thresholds decide whenever they can: a measured value on a
  -- threshold-banded test. Nobody hand-sets these, staff included, so a
  -- direct band write is simply recomputed from the value.
  if not coalesce(v_judgment, false)
     and new.value is not null and v_imp is not null and v_healthy is not null then
    if v_higher then
      if    new.value >= v_healthy then new.band := 'healthy'::assessment_band;
      elsif new.value >= v_imp     then new.band := 'improving'::assessment_band;
      else                              new.band := 'needs_attention'::assessment_band;
      end if;
    else
      if    new.value <= v_healthy then new.band := 'healthy'::assessment_band;
      elsif new.value <= v_imp     then new.band := 'improving'::assessment_band;
      else                              new.band := 'needs_attention'::assessment_band;
      end if;
    end if;
    return new;
  end if;

  -- No computable band: a judgment test, a missing value, or unset
  -- thresholds. A coach's supplied band is their read on the day and
  -- stands. Any other writer (a client self-reporting, a service path)
  -- gets no band rather than their own.
  if coalesce(public.get_user_role() in ('owner', 'coach'), false) then
    return new;
  end if;
  new.band := null;
  return new;
end;
$$;

-- Recreate the trigger so band writes fire it too (the loophole fix).
drop trigger if exists trg_compute_assessment_band on assessment_results;
create trigger trg_compute_assessment_band
  before insert or update of value, assessment_id, band on assessment_results
  for each row execute function public.compute_assessment_band();

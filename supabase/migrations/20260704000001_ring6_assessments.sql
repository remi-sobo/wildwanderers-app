-- ============================================================
-- Wild Wanderers — Ring 6: Assessment and Longevity
--
-- Simple, repeatable fitness tests, scored healthy / improving /
-- needs attention, tracked over time. One shared engine expressed two
-- ways: a longevity profile for adults (clients) beside the Ring 2
-- wellness ring, and the same movements as earned experiences for the
-- boys (participants). See RING6_SPEC.md.
--
-- The not-medical guardrail leads here, with teeth:
--   * Every test is a fitness self-assessment, self-reported or coach
--     observed, never a medical measurement. The three bands are a
--     starting point for a conversation, never a grade, never clinical.
--   * VO2 max, HRV, and heart-rate recovery are device estimates
--     (source = 'device_estimate'), trend fuel, not health verdicts.
--   * Body fat and progress photos are opt-in (is_body_composition),
--     off unless the client consents via consent_kind 'body_composition'.
--   * Strict RLS from this first migration: a client manages and reads
--     only their own results; staff read and write within their org;
--     participant results are staff-only; no cross-client, no cross-org.
--   * Bands are stamped by a trigger from the catalog's own thresholds,
--     so a client can never set their own band.
--
-- Forks the Ring 0/1/2/5 patterns: org_id on every row, the get_user_*
-- and current_user_client_id() helpers, SECURITY DEFINER where a read
-- must cross RLS, seeded configuration (not fabricated results).
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type pillar as enum (
  'move_well',      -- mobility and balance
  'be_strong',      -- body-weight strength
  'carry',          -- carry things
  'go_far',         -- endurance and recovery
  'move_fast',      -- speed, agility, power
  'recover_well',   -- sleep, breath, heart
  'healthy_habits'  -- steps, outdoor hours, water, protein
);
create type assessment_band    as enum ('healthy', 'improving', 'needs_attention');
create type assessment_subject as enum ('client', 'participant');
create type result_source      as enum ('self_reported', 'coach_observed', 'device_estimate');

-- Extend the Ring 2 consent to gate the body-composition opt-in. The base
-- health_tracking consent (copy bumped to v2 in the app) covers recording
-- tests; this separate kind gates body fat and progress photos, off by default.
alter type consent_kind add value if not exists 'body_composition';

-- ============================================================
-- ASSESSMENTS — the shared catalog. One definition of each test, per org.
-- Staff edit it; clients read the active rows to render their profile.
-- Starter bands are configuration Gabe tunes (like the Ring 5 badge
-- catalog and the Ring 4 placeholder prices), never clinical fact.
-- ============================================================
create table assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  slug text not null,
  pillar pillar not null,
  unit text not null,                 -- 'reps', 'seconds', 'meters', 'cm', 'bpm', ...
  higher_is_better boolean not null default true,
  how_to text,
  band_improving numeric,             -- the middle cutoff; null = no band set yet
  band_healthy numeric,               -- the "healthy" cutoff; direction decides the side
  boys_experience_name text,          -- the earned-experience name, e.g. 'Heron balance'
  library_item_id uuid references exercise_library(id) on delete set null,
  is_body_composition boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);
create index idx_assessments_org on assessments (org_id);
create index idx_assessments_pillar on assessments (org_id, pillar);

-- ============================================================
-- ASSESSMENT RESULTS — one row per test taken, for a client OR a
-- participant. Band is trigger-stamped from the catalog thresholds.
-- ============================================================
create table assessment_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  assessment_id uuid references assessments(id) on delete cascade not null,
  subject assessment_subject not null,
  client_id uuid references clients(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  value numeric,                      -- the measured number, null for observed-only
  value_text text,                    -- an observed pass/fail or note-only result
  band assessment_band,               -- trigger-stamped; null when value or bands absent
  taken_on date not null default (now() at time zone 'utc')::date,
  source result_source not null default 'coach_observed',
  device_note text,                   -- the smartwatch label for a device estimate
  recorded_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  constraint one_subject check (
    (subject = 'client'      and client_id      is not null and participant_id is null) or
    (subject = 'participant' and participant_id is not null and client_id      is null)
  )
);
create index idx_results_client on assessment_results (client_id, assessment_id, taken_on desc);
create index idx_results_participant on assessment_results (participant_id, assessment_id, taken_on desc);
create index idx_results_org on assessment_results (org_id);

-- ── exercise_library: carry a pillar and, where it maps, an assessment ──
alter table exercise_library add column pillar pillar;
alter table exercise_library
  add column assessment_id uuid references assessments(id) on delete set null;

-- ============================================================
-- BAND TRIGGER — stamp the band from the catalog thresholds. SECURITY
-- DEFINER so it can read the catalog even when a client (whose insert
-- fired it) could not, and so the band is never client-supplied.
-- ============================================================
create or replace function public.compute_assessment_band()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_higher boolean;
  v_imp numeric;
  v_healthy numeric;
begin
  if new.value is null then
    new.band := null;
    return new;
  end if;

  select higher_is_better, band_improving, band_healthy
    into v_higher, v_imp, v_healthy
  from public.assessments where id = new.assessment_id;

  if v_imp is null or v_healthy is null then
    new.band := null;               -- no band configured yet
    return new;
  end if;

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
end;
$$;

-- A trigger function is never meant to be called directly. Revoke the
-- RPC surface so it is not reachable via /rest/v1/rpc by anon or signed-in
-- users (matches the Ring 0 helpers, which revoke from public and anon).
revoke execute on function public.compute_assessment_band() from public, anon, authenticated;

create trigger trg_compute_assessment_band
  before insert or update of value, assessment_id on assessment_results
  for each row execute function public.compute_assessment_band();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table assessments        enable row level security;
alter table assessment_results enable row level security;

-- ── assessments: staff manage in org; clients read active in org ──
create policy "staff_manage_assessments"
  on assessments for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "clients_read_active_assessments"
  on assessments for select
  using (org_id = get_user_org() and get_user_role() = 'client' and is_active);

-- ── assessment_results ──
-- A client manages only their OWN client-subject results.
create policy "clients_manage_own_results"
  on assessment_results for all
  using (org_id = get_user_org() and get_user_role() = 'client'
         and subject = 'client' and client_id = any (current_user_client_id()))
  with check (org_id = get_user_org() and get_user_role() = 'client'
         and subject = 'client' and client_id = any (current_user_client_id()));

-- Staff manage every result in their org (client and participant alike).
-- Participant rows match only this policy, so a client sees zero of them.
create policy "staff_manage_results"
  on assessment_results for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- ============================================================
-- SEED — the starter assessment catalog for Wild Wanderers Fitness.
-- Configuration, clearly named, editable by Gabe. Bands are STARTING
-- POINTS, not medical thresholds. Idempotent (on conflict do nothing).
-- ============================================================
insert into assessments
  (org_id, name, slug, pillar, unit, higher_is_better, how_to,
   band_improving, band_healthy, boys_experience_name, is_body_composition)
select o.id, v.name, v.slug, v.pillar::pillar, v.unit, v.higher_is_better, v.how_to,
       v.band_improving::numeric, v.band_healthy::numeric, v.boys_experience_name, v.is_body_composition
from (select id from organizations where slug = 'wild-wanderers-fitness') o
cross join (values
  -- move_well (mobility and balance)
  ('Single-leg balance','single_leg_balance','move_well','seconds',true,'Stand on one foot, hands on hips, eyes open. Time until the foot moves.',15,30,'Heron balance',false),
  ('Eyes-closed balance','eyes_closed_balance','move_well','seconds',true,'Same as single-leg, eyes closed. Time until the foot moves.',5,15,null,false),
  ('Beam walk','beam_walk','move_well','steps',true,'Heel-to-toe along a line or low beam. Count controlled steps before a wobble.',8,16,'Mountain goat',false),
  ('Deep squat hold','deep_squat_hold','move_well','seconds',true,'Sink to a full squat, heels down, and hold. Time the comfortable hold.',30,60,null,false),
  ('Sit-and-reach','sit_and_reach','move_well','cm',true,'Seated, legs straight, reach past the toes. Measure past (＋) or short of (－) the toes.',0,7,null,false),
  ('Ankle mobility','ankle_mobility','move_well','cm',true,'Knee-to-wall: how far the foot sits from the wall while the knee still touches.',8,12,null,false),
  ('Overhead reach','overhead_reach','move_well','pass',true,'Arms overhead against a wall, ribs down. Coach notes full, partial, or limited.',null,null,null,false),
  -- be_strong (body-weight strength)
  ('Push-ups','push_ups','be_strong','reps',true,'Full range, straight line, elbows about 45 degrees. Count clean reps.',10,25,null,false),
  ('Pull-ups','pull_ups','be_strong','reps',true,'Full hang to chin over the bar. Count clean reps.',3,8,'Tree climber',false),
  ('Dead hang','dead_hang','be_strong','seconds',true,'Hang from the bar, full grip. Time the hold.',30,60,null,false),
  ('Bodyweight squats','bodyweight_squats','be_strong','reps',true,'Full-depth squats at a steady pace. Count clean reps.',20,40,null,false),
  ('Plank hold','plank_hold','be_strong','seconds',true,'Forearm plank, one straight line, ribs down. Time the hold.',45,90,null,false),
  -- carry
  ('Farmers carry','farmers_carry','carry','meters',true,'Carry a moderate load in each hand, tall and steady. Measure the distance.',30,60,null,false),
  ('Loaded carry hold','loaded_carry_hold','carry','seconds',true,'Hold a moderate load at the sides, tall posture. Time the hold.',30,60,null,false),
  -- go_far (endurance and recovery)
  ('Cooper 12-minute run','cooper_12min','go_far','meters',true,'Cover as much ground as you can in 12 minutes. Measure the distance.',1600,2400,'Redwood endurance',false),
  ('Rockport mile walk','rockport_walk','go_far','minutes',false,'Walk one mile as briskly as you can. Record the time.',18,14,null,false),
  ('6-minute walk','six_min_walk','go_far','meters',true,'Cover as much ground as you can walking for 6 minutes. Measure the distance.',400,550,null,false),
  ('Timed hike','timed_hike','go_far','minutes',false,'A set one-mile trail loop. Record the time.',25,18,'Coyote trail runner',false),
  -- move_fast (speed, agility, power)
  ('Standing broad jump','broad_jump','move_fast','cm',true,'From a standstill, jump forward for distance. Measure heel to line.',150,200,'Mountain leap',false),
  ('Vertical jump','vertical_jump','move_fast','cm',true,'Reach and mark, then jump and mark. Measure the difference.',30,50,'Hawk flight',false),
  ('40-metre sprint','sprint_40m','move_fast','seconds',false,'Sprint 40 metres from a standing start. Record the time.',7.5,6.0,'Jackrabbit sprint',false),
  ('Agility ladder','agility_ladder','move_fast','seconds',false,'A set footwork pattern through the ladder. Record the time.',12,8,'Ground squirrel agility',false),
  ('Lateral bound','lateral_bound','move_fast','cm',true,'Bound sideways off one foot for distance, land in control. Measure it.',80,130,'Rock hopper',false),
  -- recover_well (sleep, breath, heart)
  ('Resting heart rate','resting_hr','recover_well','bpm',false,'Measured at rest, ideally on waking. A smartwatch estimate is fine.',75,60,null,false),
  ('Heart-rate recovery','hr_recovery','recover_well','bpm',true,'The drop in heart rate one minute after hard effort. A watch estimate is fine.',12,25,null,false),
  ('HRV (estimate)','hrv','recover_well','ms',true,'Heart-rate variability, as a smartwatch reports it. A trend number, not a verdict.',40,70,null,false),
  ('Sleep','sleep','recover_well','hours',true,'Average nightly sleep over the past week.',6,7.5,null,false),
  -- healthy_habits
  ('Daily steps','steps','healthy_habits','steps',true,'Average daily step count over the past week.',6000,10000,null,false),
  ('Outdoor hours','outdoor_hours','healthy_habits','hours',true,'Hours spent outdoors over the past week.',3,7,null,false),
  ('Water','water','healthy_habits','liters',true,'Average water intake per day, in litres.',1.5,2.5,null,false),
  ('Protein','protein','healthy_habits','grams',true,'Average protein per day, in grams.',80,120,null,false),
  -- body composition (opt-in, private, no band)
  ('Body fat','body_fat','be_strong','percent',false,'Optional and private. An estimate only. No band, just your own trend.',null,null,null,true),
  ('Progress photo','progress_photo','be_strong','photo',true,'Optional and private. A photo you keep to see your own change over time.',null,null,null,true)
) as v(name, slug, pillar, unit, higher_is_better, how_to, band_improving, band_healthy, boys_experience_name, is_body_composition)
on conflict (org_id, slug) do nothing;

-- ── The animal-named movements into the shared exercise library, each
--    with its pillar, so Coach AI can draft with them and both programs
--    draw from one source. Linked to their assessment below. ──
insert into exercise_library (org_id, title, kind, muscle_group, instructions, cues, pillar)
select o.id, v.title, v.kind::exercise_kind, v.muscle_group, v.instructions, v.cues, v.pillar::pillar
from (select id from organizations where slug = 'wild-wanderers-fitness') o
cross join (values
  ('Heron balance','skill','Balance','Stand tall on one foot, still as a heron.','Fix your eyes ahead, breathe slow, own the stillness.','move_well'),
  ('Mountain goat','skill','Balance and mobility','Sure-footed heel-to-toe along a beam or line.','Steady steps, arms easy, feel each foot land.','move_well'),
  ('Tree climber','strength','Back and grip','Pulling and climbing strength, hands over hands.','Full hang, pull the elbows down, chin leads.','be_strong'),
  ('Redwood endurance','cardio','Aerobic base','Go long and steady, tall as a redwood.','Even pace, easy breath, keep the rhythm.','go_far'),
  ('Coyote trail runner','cardio','Aerobic base','Cover trail ground at a smart, steady clip.','Light feet, look ahead, save something for the finish.','go_far'),
  ('Hawk flight','skill','Power','Spring up and reach, like a hawk taking off.','Load the legs, explode up, reach high.','move_fast'),
  ('Jackrabbit sprint','skill','Speed','A quick burst of top-end speed off the line.','Drive the arms, quick feet, run tall.','move_fast'),
  ('Ground squirrel agility','skill','Agility','Quick, darting footwork through the pattern.','Short steps, stay low, change direction sharp.','move_fast'),
  ('Mountain leap','skill','Power','A big standing leap forward for distance.','Swing the arms, jump far, stick the landing.','move_fast'),
  ('Rock hopper','skill','Power and balance','Bound side to side and land in control, like crossing rocks.','Push off one foot, land soft, hold the balance.','move_fast')
) as v(title, kind, muscle_group, instructions, cues, pillar)
on conflict (org_id, title) do nothing;

-- Link each animal movement to its assessment (and backfill pillar if the
-- library row pre-existed without one).
update exercise_library el
set assessment_id = a.id,
    pillar = coalesce(el.pillar, a.pillar)
from assessments a,
     (values
       ('Heron balance','single_leg_balance'),
       ('Mountain goat','beam_walk'),
       ('Tree climber','pull_ups'),
       ('Redwood endurance','cooper_12min'),
       ('Coyote trail runner','timed_hike'),
       ('Hawk flight','vertical_jump'),
       ('Jackrabbit sprint','sprint_40m'),
       ('Ground squirrel agility','agility_ladder'),
       ('Mountain leap','broad_jump'),
       ('Rock hopper','lateral_bound')
     ) as m(title, slug)
where el.title = m.title
  and a.slug = m.slug
  and a.org_id = el.org_id
  and el.org_id = (select id from organizations where slug = 'wild-wanderers-fitness');

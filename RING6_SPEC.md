# Ring 6 — Assessment and Longevity (Wild Wanderers Platform)

Simple, repeatable fitness tests people understand and want to improve, scored
healthy, improving, or needs attention, and tracked over time. One shared engine,
expressed two ways: a longevity profile for adults on Fitness, and the same
movements as earned experiences for boys on the Program side. This sits alongside
the Ring 2 wellness ring, it does not replace it. The ring measures capacity (am I
getting more capable); the ring already built measures consistency (am I showing
up). Two honest numbers, never merged.

Source: `WW_App_Assessment_Spec.md` (the intake and architecture), reconciled
against the built repo through Ring 5. This is the buildable ring, forked onto the
patterns already in the codebase.

## What already exists, and what we reuse
- `exercise_library` (Ring 1.5): the per-org movement catalog Coach AI drafts
  from. We extend it with a pillar and an optional link to an assessment, then
  seed the animal-named movements into it so both programs draw from one source.
- `clients` (adults) and `participants` (the boys, Ring 5): the two subjects an
  assessment result attaches to. Participants are minors with no login; their
  data stays staff-only, exactly as Ring 5 set it.
- `consents` + `audit_events` (Ring 2): reuse the consent gate and the sealed
  audit ledger. Assessment data is at least as sensitive as the weight and food
  already covered, so it rides the same machinery.
- The wellness ring and `compute_wellness_score` (Ring 2): untouched. The optional
  single "fitness score" roll-up is deferred, see the reconciliation below.

## The guardrails that lead (from CLAUDE.md and SECURITY_WW.md, with teeth here)
- **Not medical, load-bearing.** Every test is a fitness self-assessment, self
  reported or coach observed, never a medical measurement. No diagnosis, no
  clinical thresholds presented as fact. The three bands are a starting point for
  a conversation, never a grade. Every assessment surface carries the same
  progress-not-medical note the wellness score already uses, and the FAQ line
  stands: see your own doctor for medical questions.
- **Estimates stay estimates.** VO2 max, heart-rate recovery, and HRV are shown as
  numbers a smartwatch produced, framed as trend fuel, tagged `device_estimate`,
  never as a health verdict.
- **Opt-in for the sensitive edge.** Body fat and progress photos are off by
  default, opt-in through a separate consent, private, and easy to turn off. A
  client who never opts in never sees that section.
- **Never a failing grade.** "Needs attention" is the ceiling of negativity and
  reads as an invitation. The plan needs work, never the person. No percentile
  tables. This is the voice rule, and here it is not optional.
- **Consent before data.** Reuse Ring 2's consent, extend its copy to name the
  assessment data, and gate the same way: nothing is recorded until consent
  exists. Privileged reads and writes append to `audit_events`.
- **Tenancy and RLS from the first migration.** Every row scopes to `org_id`. A
  client manages only their own results and reads only their own. Staff read and
  write within their org. Participant results are staff-only. No client, no
  participant, no other org reaches across. Verified on the live DB before merge.
- **No fabricated results.** The catalog and the animal movements are
  configuration, clearly named and seeded like the Ring 5 badge catalog. Starter
  band thresholds are labeled starting points Gabe edits, never clinical fact. No
  real person's result is ever invented; the demo client is the one sanctioned
  place for sample results.

## The shared engine, expressed two ways
- **The catalog (`assessments`).** One definition of each test lives in one place:
  the Cooper 12-minute, the dead hang, single-leg balance, the farmers carry. Each
  carries its pillar, its unit, how to measure it, whether higher is better, its
  simple band thresholds, and, where it maps, its earned-experience name for the
  boys ("Heron balance") and its link to the library movement.
- **The results (`assessment_results`).** One row per test taken, for a client or
  a participant, with the value, the date, who recorded it, the source, and the
  computed band. The same row, scored the same way, whether it surfaces to an
  adult as a longevity profile or to a boy as an earned experience.
- **Adults, on Fitness.** A longevity profile per client: the seven pillars, each
  test's latest result and band, and the trend over time. Beside the wellness
  ring, not merged into it.
- **Boys, on the Program.** The same movements as earned experiences, not tests.
  Gabe records the underlying result quietly (coach observed); the boy sees growth
  and encouragement, never a test he can fail. The Gandalf-in-the-back approach.

### The seven pillars
`move_well` (mobility and balance), `be_strong` (body-weight strength), `carry`
(carry things), `go_far` (endurance and recovery), `move_fast` (speed and
agility), `recover_well` (sleep, breath, heart), `healthy_habits` (steps, outdoor
hours, water, protein). Modeled once as an enum, used by both expressions.

### The scoring, kept human
Three bands only: `healthy`, `improving`, `needs_attention`. Computed from the
assessment's own simple thresholds and its higher-is-better direction, stamped on
each result by a trigger so a client can never set their own band. No science
claimed, no percentiles, editable by Gabe per test.

## Definition of done
- Gabe (owner or coach) sees a catalog of tests, each with a pillar, a unit, how
  to measure, and simple bands he can edit.
- On a client's Fitness page he records or observes a result; the client's
  longevity profile shows the seven pillars, each test's latest band, and its
  trend, beside the existing wellness ring.
- A client, having consented, records their own self-reported result and sees
  their profile. Body composition stays hidden unless they opt in.
- On a boys program he records a result for a participant, surfaced as an earned
  experience with the animal name, never as a test or a score.
- The animal-named movements are seeded into `exercise_library` with their pillar
  and, where they map, their assessment, so Coach AI can draft with them.
- Every table is org-scoped with RLS from the first migration: a client sees only
  their own results, a client sees zero participant data, another org sees
  nothing. Verified on the live DB. `npm run build` and the type check pass. No
  fabricated results ship.

## New tables (all org-scoped)
- `assessments` — the catalog: id, org_id, name, slug, pillar (enum),
  unit (text, e.g. `reps`, `seconds`, `meters`, `cm`, `bpm`), higher_is_better
  boolean, how_to text, band_improving numeric, band_healthy numeric (the two
  cutoffs; direction decides which side is which), boys_experience_name text
  (nullable), library_item_id uuid references `exercise_library` (nullable),
  is_body_composition boolean default false (gates behind the opt-in), is_active
  boolean, created_by, timestamps, unique (org_id, slug). RLS: staff manage in
  org; clients read active rows (to render their profile). Participants have no
  login, so no participant policy.
- `assessment_results` — one row per test taken: id, org_id, assessment_id,
  subject (enum `client`/`participant`), client_id (nullable FK), participant_id
  (nullable FK), value numeric (nullable), value_text text (for an observed
  pass/fail or a note-only test), band (enum, trigger-stamped), taken_on date,
  source (enum `self_reported`/`coach_observed`/`device_estimate`), device_note
  text (the smartwatch label for estimates), recorded_by uuid references profiles,
  notes text, created_at. Check: exactly one of client_id / participant_id set,
  and it matches `subject`. Indexes on (client_id, assessment_id, taken_on desc)
  and (participant_id, assessment_id, taken_on desc).

### Enums
`pillar` (the seven above), `assessment_band` (`healthy`, `improving`,
`needs_attention`), `assessment_subject` (`client`, `participant`),
`result_source` (`self_reported`, `coach_observed`, `device_estimate`).

### Consent
Extend `consent_kind` with `body_composition` for the body-fat and progress-photo
opt-in, and bump the `health_tracking` consent copy to v2 so it names the
assessment data. The base consent covers recording tests; the separate
`body_composition` consent gates that one section, off by default.

### `exercise_library`, extended
Add `pillar` (enum, nullable) and `assessment_id` (uuid, nullable FK to
`assessments`) so a movement carries its pillar and, where it maps, its
assessment. A boy's ground-squirrel agility course and an adult's ladder drill
become the same underlying thing.

### The band trigger
A `BEFORE INSERT OR UPDATE` trigger on `assessment_results` reads the assessment's
thresholds and direction and stamps `band`. This keeps the band honest under a
plain client-manages-own RLS insert: the client supplies the value, the database
supplies the band. No definer chokepoint needed for the common path; audit writes
ride the same admin chokepoint Ring 2 uses.

## Row level security (the shape, ported from Ring 2 and Ring 5)
- `assessments`: `staff_manage_assessments` (owner/coach, all, in org);
  `clients_read_active_assessments` (client, select, active, in org).
- `assessment_results`, client rows: `clients_manage_own_results` (client, all,
  where subject = client and client_id in `current_user_client_id()`);
  `staff_manage_client_results` (owner/coach, all, in org).
- `assessment_results`, participant rows: `staff_manage_participant_results`
  (owner/coach, all, in org). No client and no participant policy: a client sees
  zero participant results, a participant has no login. The family read-only view
  (a parent seeing their own child's earned experiences) is decision 4 below.
- `consents`: the Ring 2 policies already cover the new kind; no change beyond the
  enum value and the copy.

## Surfaces
- **Client, on Progress (`/progress`).** A longevity profile beside the wellness
  ring: the seven pillars, each with its latest result and band and a small trend
  line. A record-a-result action for self-reported tests, gated by consent. The
  body-composition section renders only if the client has opted in, with a clear
  turn-off. The label for the section is decision 2.
- **Coach, on a client's Fitness page (`/program/clients/[id]`).** A longevity
  panel next to the wellness summary: record or observe a result, see the pillars,
  the bands, and the trends. This is where Gabe coaches capacity off real data.
- **Coach, on a boys program (`/boys/[id]`).** Per participant, record a result as
  an earned experience: pick the movement, enter what he did, and it lands as
  encouragement with the animal name and the pillar, never a band shown as a
  grade. The underlying row is scored the same way for Gabe's own read.
- **The catalog.** A staff view (settings or a Fitness sub-page) to see and edit
  the tests and their bands. Seeded, editable, never presented as clinical fact.

## Seed (configuration, clearly named, like the Ring 5 badge catalog)
- The assessment catalog from the transcript's set, each mapped to a pillar with a
  unit, how-to, direction, and starter bands Gabe tunes (labeled starting points):
  aerobic (Cooper 12-minute, Rockport mile walk, beep test, 6-minute walk),
  strength (push-ups, pull-ups or dead hang, squats, farmers carry grip), mobility
  (deep squat hold, toe touch, overhead reach, ankle), balance (single-leg,
  eyes-closed, beam walk, Y-balance), power (broad and vertical jump, med-ball
  throw), speed and agility (sprint, ladder, timed obstacle course), work capacity
  (timed hike, step test, loaded carry), recovery (resting heart rate, heart-rate
  recovery, HRV if available, sleep). Body composition (body fat, progress photos)
  seeded with `is_body_composition = true`, off unless opted in.
- The animal-named movements seeded into `exercise_library` with their pillar and,
  where they map, their `assessment_id`: rock hopper, mountain goat, heron balance,
  ground squirrel agility, coyote trail runner, redwood endurance, hawk flight,
  jackrabbit sprint, mountain leap, tree climber.
- `supabase/seed/demo_client.sql`: extend the demo client with a handful of
  assessment results across a few pillars and a couple of dates, so Gabe sees a
  populated, mid-journey longevity profile. The demo account is the only place
  results are seeded; no real client is ever fabricated.

## The wellness score, reconciled
The Ring 2 daily ring stays exactly as is, it measures consistency and it is good.
The longevity profile is a separate, periodic view of capacity. We do not merge
them into one number. The optional single headline "fitness score" (a transparent
roll-up of the assessment bands, with the same not-medical note) is deferred: we
build it only if Gabe asks, and even then it is a roll-up, not a new measurement.

## Commit sequence
1. **Migration** — the enums, `assessments`, `assessment_results`, the band
   trigger, the consent extension, the `exercise_library` columns, RLS on every
   new table and path, the seeded catalog and animal movements, and the demo
   results. Verified in the DB with an isolation check: a client reads only their
   own results, a client sees zero participant results, another org sees nothing.
2. **Adult longevity profile (client)** — the Progress view: seven pillars, latest
   band, trend, record a self-reported result behind consent, body composition
   gated by the opt-in.
3. **Coach Fitness panel** — the per-client longevity panel beside the wellness
   summary: observe or record a result, bands, trends. Plus the catalog editor.
4. **Boys earned experiences** — the `/boys/[id]` record-as-experience flow,
   surfaced as encouragement with the animal name, scored the same underneath.
5. **Final pass** — the not-medical copy on every surface, audit wiring for
   assessment reads and writes, reconcile CURRENT.md and the docs, confirm no
   fabricated results, then merge.

Each commit: build green, one change at a time, RLS on every new table, no client
reaching another client's or a participant's data, no medical claim and no
fabricated result, shown before it lands.

## Decisions to lock before build
1. **The shared engine** — one assessment model for boys and adults, expressed two
   ways. This is the architectural call everything hangs on, and the market look
   backs it: the functional test set the transcript chose (grip and dead hang,
   single-leg balance, walking speed, chair stand, push-ups, Cooper and VO2) is
   exactly what current longevity practice converges on, and the field frames
   "longevity" as supporting recommended training, never guaranteeing lifespan,
   which is our not-medical guardrail already. **Recommend yes.** (Intake line 136.)
2. **The adult section's name** — Gabe dislikes clinical words. "Longevity
   profile" is the working title; alternatives are "Capacity," "Milestones," or a
   warmer coined name. Gabe's call.
3. **Body composition default** — off, opt-in, easy to turn off. Recommend
   confirming as specified.
4. **Family view of earned experiences** — extend the Ring 5 parent read-only view
   to show a child's earned experiences and growth. Build this ring, or hold for
   the boys-program completions ring? Recommend holding, to keep this ring tight.
5. **Carried-over Gabe decisions** — if a philosophy or mentor-training surface
   later shows faith or the Kyezen spelling, the answers are the same as the site
   spec. Not re-litigated here. (Intake line 133.)

## Not in this ring (the boys-program completions come next)
The intake also lists boys-program completions: family-first onboarding, the forms
(waiver, medical, photo release, pickup, code of conduct, parent agreement), the
warmer-worded enrollment pipeline tied to the Ring 4 offerings, the student
adventure log, and mentor onboarding with the brotherhood layer. Those are the
next ring, sequenced after this one, with one exception the intake is firm on: if a
real family needs a liability waiver before a session, forms jump the line,
because a waiver is the one thing a session cannot run without.

## The craft pass still owed
Per the craft-pass loop, the visual mock of the longevity profile and the boys'
earned-experience view, in Gabe's design, comes before commit 2's UI lands. The
architecture, the schema, the guardrails, and the commit sequence above are the
part to lock now; the screens get their just-in-time design pass against the best
current assessment apps when we build them.

## Decisions locked (2026-07-04)
1. **The shared engine** — confirmed. One assessment model for boys and adults,
   expressed two ways.
2. **The adult section's name** — "Longevity" for now (working title, one string
   to change if Gabe wants "Capacity" or another word).
3. **Body composition** — off by default, opt-in through a separate consent, easy
   to turn off.
4. **Family view of earned experiences** — held for the boys-program completions
   ring, to keep this ring tight.

## Follow-up (2026-07-19): bands by coach judgment
The assessment spec's scoring model allows a band set from a simple per-test
target "or by his own judgment on the day." That second path is now built:
`assessments.use_coach_judgment` flags a test as judgment-banded (Overhead
reach seeded as the first), the coach's record surfaces (client panel and the
boys' Experiences tab) offer the three-band read on the day for those tests,
and the catalog editor lets Gabe switch a test between simple targets and his
own read. The band trigger honors a staff-supplied band only where thresholds
cannot decide; wherever they can, it computes, staff included.

The same migration closed a gap in the original ring: the trigger fired only
on value and assessment_id, so a client could update band directly on their
own row (the manage-own policy is FOR ALL) and hand themselves "healthy." The
trigger now fires on band writes too and clears any non-staff band, verified
on the live DB: a client-supplied band is nulled, a client band update is
recomputed from the value, an owner judgment band stands, and thresholds
outrank staff on computable tests. The client self-report path still never
sets a band, anywhere.

## Build status
Built in five commits on `claude/ww-assessment-z1hbai`: the schema, RLS, band
trigger, and seeded catalog (6.1); the client longevity profile (6.2); the coach
panel and catalog editor (6.3); the boys' earned experiences (6.4); and this final
pass (6.5). The migration is applied and verified on the live project: bands
compute in both directions, a client sees only their own results and is blocked
from writing for another, participant results are staff-only, and the demo client
carries a mid-journey profile. Build and type check green. No fabricated results;
the only seeds are the catalog, the animal movements, and the demo client.

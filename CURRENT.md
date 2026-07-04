# CURRENT.md — Wild Wanderers Platform status

A running log of where the build is. Update it at the end of every work session,
newest at the top. This is the fast answer to "where are we."

## Status
Rings 0 through 6 built. Ring 6 is the Assessment and Longevity system: one
shared engine (an assessments catalog and assessment_results) expressed two ways.
Adults get a longevity profile on Progress and on each client's Fitness page, the
seven pillars with each test's latest band and its trend, beside the daily
wellness ring, never merged into it. Boys get the same movements as earned
experiences on the program, the animal-named versions (Tree climber, Heron
balance, Redwood endurance), recorded quietly and surfaced as encouragement,
never a test to fail. A before-insert trigger stamps the human band (healthy,
improving, needs attention) from the catalog's own editable thresholds, so a
client can never set their own. Body fat and progress photos are opt-in, private,
and off by default. Strict RLS from the first migration, verified on the live DB.
Gabe tunes the tests and bands in a staff catalog editor. No fabricated results;
the only seeds are the catalog, the animal movements, and the demo client's
mid-journey profile. Next up: the boys-program completions (family-first
onboarding, forms and waivers, enrollment, the adventure log, mentor onboarding).

Rings 0 through 4 are on main; Ring 5 is built and
verified on the branch, ready to merge. Ring 5 is the boys program (Dads &
Kids), run the way a nonprofit runs an after-school program, minus impact,
evaluation, and fundraising: staff create programs and cohorts, build the roster
of kids and parents, schedule sessions, take attendance, and award a light
motivational badge. Parents get their own read-only view of their own kids'
schedule, attendance, and badges, behind an invite-and-login flow. The road to
resale is folded in: the owner edits the org's white-label fields (name, logo,
colors) and invites a second coach, and the shell now shows the org name.
Everything is staff-only or parent-own-child, verified on the live DB (a client
sees zero kid data; a parent sees only their own child). No fabricated kids;
only the badge catalog is seeded.

Ring 4 is the business switch,
Gabe's owner-only back office: a command dashboard (active clients, revenue this
month, open pipeline, follow-ups due, goals with live progress), a light CRM and
pipeline (add a lead, move it through stages, convert to a customer), finance
(offerings with prices Gabe sets, revenue and expenses with month totals), and
tasks with pin-for-today plus goals the dashboard measures. Every business table
is RLS-gated to the owner from the first migration; a client sees zero of all of
them, verified on the live DB. No fabricated financials: business opens empty
and only the offerings catalog is seeded, with placeholder prices.

Ring 3 is Coach AI: a floating
Coach button on the coach shell opens a drawer where Gabe summarizes a client
or drafts a workout (Coach drafts from the exercise library, it opens pre-filled
in the plan builder, Gabe reviews and activates, nothing auto-goes-live).
Clients leave text or voice check-ins on their Log surface; Coach structures
them into a fast read Gabe keeps. Every Claude call goes through one chokepoint
that budgets ($25/mo cap), sweeps the Wild Wanderers voice, and logs to sealed
ledgers (ai_calls, voice_violations). Coach lights up when ANTHROPIC_API_KEY is
set in Vercel; voice needs DEEPGRAM_API_KEY. Until then everything degrades to a
friendly not-configured state. The ledgers, check-in, and voice-audio paths are
verified under RLS on the live project.

Ring 2 is the wellness tracker: a
client consents once (plain, not-medical), then logs weight and measurements,
checks off habits, logs movement, and logs food from their phone on the Log
surface. Progress shows the graphs and a transparent wellness score (a warm
fern-to-amber ring, consistency 0.5 / movement 0.25 / habits 0.25, always with
its progress-not-medical note). Gabe coaches off it on Fitness, per client,
with a summary on each client's Program page. Food search hits two free
providers (USDA FoodData Central + Open Food Facts) and caches to food_items.
All body/food tables have strict RLS from the first migration, access appends
to a sealed audit ledger, and isolation is verified on the live project
(other client sees zero and is blocked from the score; owner sees the org).
Notes: inviting a client login and writing audit rows both need
SUPABASE_SERVICE_ROLE_KEY in Vercel; set FDC_API_KEY for reliable food search.
Coach AI (Ring 3) will draft workouts and structure the check_ins captured here.

## Demo client (standing practice)
`demo.client@wildwanderers.life` is a clearly-labeled demo account so Gabe can
walk the client side and see a fully built-out, mid-plan client. It is the one
place we seed sample data; real client records are never fabricated. Every ring,
extend `supabase/seed/demo_client.sql` to fill the demo client's new surfaces
with that ring's functionality (training plan and workouts at Ring 1;
measurements, habits, wellness score at Ring 2; and so on). Ring 0 populated its
profile, goal, and a coaching group.

## The rings (from docs/master-spec.md)
- Ring 0: the shell. Fork schema, retarget names, seed one org, auth, RLS, role
  routing, app shell in the Wild Wanderers aesthetic. Nearly done, deployed.
- Ring 1: the spine. One client, a hand-built training plan, today's workout,
  completion, messaging, the next session. Done, deployed. Plus Ring 1.5, an
  exercise library the plan builder pulls from.
- Ring 2: the wellness tracker. Measurements, graphs, habits, the wellness score,
  food and activity logging. Done, on the branch. PWA install deferred to a
  later pass so it can be tested on a device.
- Ring 3: Coach AI. The chokepoint (budget, voice sweep, sealed ledgers), the
  coach-only Coach FAB and drawer, client summaries, workout drafting (draft to
  approve), text and voice check-in structuring. Done, on the branch.
- Ring 4: the business switch. Owner-only command dashboard, CRM and pipeline,
  offerings, revenue and expenses (manual now, Stripe reserved), tasks with
  pin-for-today, and goals. Done, on the branch. Deferred: the Stripe webhook
  ingest, the public website-inquiry lead capture, payroll and commissions.
- Ring 5: the boys program (Dads & Kids) and the road to resale. Programs,
  cohorts, roster, schedule, attendance, badges, the family-facing parent view,
  and the white-label settings plus coach invite. Done, on the branch. No
  evaluation or fundraising, by design.
- Ring 6: the Assessment and Longevity system. One shared engine (assessments +
  assessment_results), a longevity profile for adults beside the wellness ring,
  the same movements as earned experiences for the boys, human three-band scoring
  via a trigger, a staff catalog editor, opt-in body composition, the not-medical
  guardrail throughout. Built and verified on the live DB. See RING6_SPEC.md.

## Decisions locked
- Fork the Team Esface backend, rebuild the UI in the Wild Wanderers aesthetic.
- Multi-tenant schema now, one org live (Wild Wanderers Fitness).
- Coach AI scoped to programming, habits, and summarizing. Gabe approves plans.
- Wellness score is motivational, not medical.

## Open
- The boys-program completions are the next ring: family-first onboarding, the
  forms (waiver, medical, photo release, pickup, code of conduct, parent
  agreement), the warmer-worded enrollment pipeline tied to the Ring 4 offerings,
  the student adventure log, and mentor onboarding. Forms jump the line if a real
  family needs a waiver before a session.
- The family read-only view of a boy's earned experiences is deferred to that
  ring (Ring 6 decision 4).
- PWA install shell (manifest, service worker, icons), a later pass.
- Vercel env vars: ANTHROPIC_API_KEY (Coach), DEEPGRAM_API_KEY (voice check-ins),
  FDC_API_KEY (food search), SUPABASE_SERVICE_ROLE_KEY (audit writes, voice
  playback, invite-by-email). Coach and voice degrade gracefully until set.

## Log
- 2026-07-04 Ring 6 built (five commits): the assessment schema + RLS + band
  trigger + seeded catalog and animal movements (6.1), the client longevity
  profile (6.2), the coach panel and catalog editor (6.3), the boys' earned
  experiences (6.4), and the final pass (6.5). Band computation, client and
  cross-client isolation, the write block, and the participant path all verified
  on the live DB. No fabricated results; catalog, animal movements, and the demo
  client's profile are the only seeds.
- 2026-07-04 Ring 6 spec drafted (RING6_SPEC.md): the Assessment and Longevity
  system, one shared engine expressed two ways, then confirmed and built the same
  day.
- 2026-07-04 Ring 5 built (six commits): boys program schema + staff/parent RLS
  + badge seed, the Dads & Kids shell and programs list, the program detail
  (roster, schedule, attendance, badges), the family-facing parent view, the
  white-label settings and coach invite, final pass. Staff, write-path, and
  parent isolation verified on the live DB. No fabricated kids.
- 2026-07-04 Ring 4 built (six commits): business schema + owner-only RLS +
  offerings seed, the owner-guarded business shell and command dashboard, the
  pipeline and CRM, finance, tasks and goals, final pass. Owner-only isolation
  and every write path verified on the live DB. No demo seeding (Gabe's real
  data); no fabricated financials.
- 2026-07-03 Ring 3 built (six commits): sealed AI ledgers + chokepoint (budget,
  voice sweep), the coach-only Coach FAB and drawer, client summaries, workout
  drafting, text and voice (Deepgram) check-in structuring, final pass. Ledgers
  sealed and check-in/voice-audio paths verified under RLS on the live DB.
- 2026-07-03 Ring 2 built (six commits): wellness schema + RLS + score function
  + demo seed, consent gate and Log, Progress graphs and score, Coach Fitness,
  food logging (USDA + Open Food Facts), final pass. Verified on the live DB.
- 2026-07-03 Ring 0 built: foundation migration (applied + verified), auth
  plumbing, login screen with the golden-hour trail hero, coach and client
  shells with role routing, owner and first-client seeded. Deployed to Vercel.
- (date) Repo created, docs staged. Ready for Ring 0.

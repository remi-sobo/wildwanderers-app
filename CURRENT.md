# CURRENT.md — Wild Wanderers Platform status

A running log of where the build is. Update it at the end of every work session,
newest at the top. This is the fast answer to "where are we."

## Status
Rings 0, 1, and 2 complete. Rings 0 and 1 are deployed; Ring 2 is built and
verified on the branch, ready to merge. Ring 2 is the wellness tracker: a
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
- Ring 3: Coach AI. Workout drafting, check-in structuring, coach nudges. Not
  started.
- Ring 4: the business switch. Command dashboard, clients and pipeline, offerings,
  Stripe revenue, expenses, tasks, goals. Not started.
- Ring 5: the boys program management and the road to resale. Not started.

## Decisions locked
- Fork the Team Esface backend, rebuild the UI in the Wild Wanderers aesthetic.
- Multi-tenant schema now, one org live (Wild Wanderers Fitness).
- Coach AI scoped to programming, habits, and summarizing. Gabe approves plans.
- Wellness score is motivational, not medical.

## Open
- PWA install shell (manifest, service worker, icons), a later pass.
- Set FDC_API_KEY and SUPABASE_SERVICE_ROLE_KEY in Vercel (food search, audit,
  invite-by-email).

## Log
- 2026-07-03 Ring 2 built (six commits): wellness schema + RLS + score function
  + demo seed, consent gate and Log, Progress graphs and score, Coach Fitness,
  food logging (USDA + Open Food Facts), final pass. Verified on the live DB.
- 2026-07-03 Ring 0 built: foundation migration (applied + verified), auth
  plumbing, login screen with the golden-hour trail hero, coach and client
  shells with role routing, owner and first-client seeded. Deployed to Vercel.
- (date) Repo created, docs staged. Ready for Ring 0.

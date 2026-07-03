# CURRENT.md — Wild Wanderers Platform status

A running log of where the build is. Update it at the end of every work session,
newest at the top. This is the fast answer to "where are we."

## Status
Ring 0 and Ring 1 complete and deployed. Sign-in works. Ring 1 is the spine:
Gabe adds a client and builds a training plan from an exercise library (Ring
1.5), the client sees today's workout on Home and ticks each exercise done in
Training, coach and client message in realtime, and the next session shows up.
Owner (Gabe), the first client (Remi), and a rich mid-plan demo client are
seeded. All verified on the live project: RLS isolation (client-to-client,
self, owner), the plan-creation RPC, client sends, and completion writes.
Note: inviting a client login from the app needs SUPABASE_SERVICE_ROLE_KEY in
Vercel; adding a client without a login works regardless. Coach AI (Ring 3)
will draft workouts from the exercise library.

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
  food and activity logging, PWA install. Not started.
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
- Nutrition API provider and cost, to confirm at Ring 2.

## Log
- 2026-07-03 Ring 0 built: foundation migration (applied + verified), auth
  plumbing, login screen with the golden-hour trail hero, coach and client
  shells with role routing, owner and first-client seeded. Deployed to Vercel.
- (date) Repo created, docs staged. Ready for Ring 0.

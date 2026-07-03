# CURRENT.md — Wild Wanderers Platform status

A running log of where the build is. Update it at the end of every work session,
newest at the top. This is the fast answer to "where are we."

## Status
Ring 0 nearly complete and deployed. Foundation migration applied and verified
on the live project (six tables, RLS on all, org isolation, hardened helpers,
signup trigger, Wild Wanderers Fitness org seeded). Auth plumbing and the
login screen are live. Coach and client shells are built with role routing and
encouraging empty states. Owner (Gabe) and the first client (Remi) are seeded.
Open item: end-to-end login could not be exercised from the build sandbox
(egress policy blocks the Supabase host); verify sign-in on the deployed app.

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
  completion, messaging, the next session. Not started.
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

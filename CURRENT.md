# CURRENT.md — Wild Wanderers Platform status

A running log of where the build is. Update it at the end of every work session,
newest at the top. This is the fast answer to "where are we."

## Status
Ring 0 not started. Repo scaffolded, Supabase project created, reference
migrations and docs in place. Awaiting the Ring 0 spec and prompt.

## The rings (from docs/master-spec.md)
- Ring 0: the shell. Fork schema, retarget names, seed one org, auth, RLS, role
  routing, app shell in the Wild Wanderers aesthetic. Not started.
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
- (date) Repo created, docs staged. Ready for Ring 0.

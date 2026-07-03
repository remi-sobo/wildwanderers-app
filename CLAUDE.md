# CLAUDE.md — Wild Wanderers Platform (app.wildwanderers.life)

The coaching platform for Wild Wanderers. A SOBO build for the client, Gabe.
One app, three surfaces: Gabe's admin and coach side, the client side, and the
business switch. Built for Gabe now, built to scale to other coaches later.

## Source of truth, in this order
1. `docs/master-spec.md` — the domain model, the surfaces, the build rings.
2. `reference/team-esface-migrations/` — the schema we FORK. Read it before
   writing any migration. Do not invent tables that already exist here.
3. This file.
Where these conflict, the higher one wins. Never restyle or re-architect away
from them without flagging it first.

## The core decision this build rests on
This is a fork, not a greenfield. Team Esface already is this app in a different
skin. We fork its backend and inherit its hardening, rebuild the UI in the Wild
Wanderers design system, retarget the domain from youth sport to adult wellness,
and add the wellness tracking layer none of the source apps have.

- Tenancy: every record scopes to `org_id`. The schema is already multi-tenant
  and white-label. Seed ONE organization now, Wild Wanderers Fitness. Do not
  hardcode Gabe anywhere a second coach's org would later need to differ.
- Roles: retarget `admin, coach, parent, athlete` to `owner, coach, client`.
  Keep `parent` available for the youth and family side later.
- Retarget map: athletes to clients, teams to groups, transformation_plans and
  plan_activities to training plans and workouts (reuse near-verbatim),
  knowledge_base_items to the exercise and wellness library, milestones and
  levels to progress and badges, schedule_events to sessions, message_threads to
  coach and client messaging, camps to the boys program management, the business
  OS tables to the business switch.
- New tables we build: measurements, food_logs and food_items, activity_logs,
  habits and habit_logs, wellness_scores, check_ins.

## Guardrails (binding, do not soften)

### Health data (load-bearing)
Clients log weight, food, and measurements, and Gabe coaches off it. Gabe is a
certified fitness trainer, not a clinician.
- The wellness score is a transparent, motivational progress number built from
  consistency, movement, and habits. It is never a medical or diagnostic
  assessment, and it carries a plain note saying so.
- Consent at onboarding covers what is tracked and how it is used.
- Strict RLS on all body and food data. Audit access. No medical claims anywhere
  in the product or in anything the AI generates.

### Coach AI scope
The AI, "Coach," drafts and adjusts workouts, structures voice and text
check-ins, and surfaces patterns for Gabe. It does programming, habits, and
summarizing only. It gives no medical, nutrition, or health advice to clients and
diagnoses nothing. Every workout it drafts is approved by Gabe before it goes
live, reusing the plan draft-and-approve status. Log every AI call to the ledger.

### Tenancy and access
Role plus `org_id` decide every surface, enforced by RLS ported from Team Esface.
No client ever sees another client. No org ever sees another org. From the first
migration, not a later pass.

### No fabricated content
Never fill a gap with a plausible client, stat, quote, or result. If a value is
unknown, leave a labeled placeholder and flag it. This holds for seed data and UI
copy alike.

### Nutrition data
Do not build a food database. Use a nutrition API and cache results in
`food_items`. Confirm the provider and cost at Ring 2.

## Design system (Wild Wanderers, NOT SOBO)
This is Gabe's product. Use the Wild Wanderers brand, the same as the marketing
site. Do not use SOBO's cream and Cormorant here.
- Colors: bone `#F6F1E7`, sand `#E7D9BF`, ink `#2A2118`, bark `#6B4A2E`,
  forest `#2E4A33`, forest-deep `#1E331F`, fern `#5F9A4F`, amber `#D98A3A`
  (the one action color), amber-deep `#BF6F1C`, mist `#C4D3CC`.
- Type: Fraunces (display, variable) for headings and numerals, Plus Jakarta
  Sans for body, labels, and all functional UI.
- Motif: the layered ridgeline and topographic contours, used sparingly, at
  headers and empty states, never behind dense data.
- App tuning: this is a working tool, so extend the palette with functional
  neutrals and clear success, warning, and error states in the same warm family.
  Calm, legible, dense where it needs to be. Clean and clear is the brief.

## Voice (for every human-facing string)
- No em dashes. Use commas or restructure.
- No AI-giveaway words: transformative, holistic, leverage, unlock, seamless,
  robust, pivotal, and that family.
- No formulaic transitions.
- Warm, direct, clear, succinct.
- Never frame a client as broken, unhealthy, or failing. The plan needs work,
  never the person. This is a wellness app, so this rule is not optional.

## Stack
Next.js App Router, TypeScript, Tailwind v4, Supabase (Postgres, Auth, Storage,
Edge Functions, Realtime), Resend, Stripe, Deepgram for voice, a nutrition API,
recharts for graphs, next-pwa for install, Vercel. GitHub under remi-sobo.

## Build discipline
- Spec first. A ring spec is approved before its code. No freelancing past the
  current ring.
- Phased. One change per commit, reversible, with a clear message.
- Diagnose before repair. Test before trust.
- `npm run build` and the type check pass before every commit. Keep it green.
- Show the plan and the diff before committing. Ask when unsure. Do not guess at
  a schema detail; read the reference migrations.

## Definition of done, per commit
It builds, types pass, RLS covers any new table, no client or org can reach
another's data, no medical claim or fabricated value shipped, and the change is
small enough to review and revert.

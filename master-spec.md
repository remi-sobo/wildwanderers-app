# Wild Wanderers Platform — Master Spec (app.wildwanderers.life)

Prepared by SOBO. The coaching platform: Gabe's admin and coach side, the client
side, and the business switch, in one app. Built for Gabe now, built to scale to
other coaches later. This is the bones and the build plan. Screen-level specs come
ring by ring, after you sign off on the model here.

---

## 0. The core decision, and why this is a fork not a greenfield

Team Esface already is this app in a different skin. It has:

- The exact three surfaces you asked for: `(admin)` coach side, `(athlete)` client
  side, and a `(business)` switch with finance, CRM, pipeline, payroll, tasks,
  and offerings.
- Multi-tenant, white-label bones already in place. Every record scopes to an
  `org_id`, and the `organizations` table carries name, slug, logo, and brand
  colors. Building for one coach and reselling to many is not a retrofit here, it
  is how the schema was designed. We seed one organization, Wild Wanderers
  Fitness, and the isolation is already there.
- A workout engine hiding in plain sight: `transformation_plans` to `plan_days`
  to `plan_activities` to `activity_completions`, with activity swaps, comments,
  and client focus requests. Gabe literally calls his coaching "transformation
  plans."
- The AI pattern we need: an edge function transcribes voice with Deepgram,
  structures it with Claude into JSON, writes it back, notifies, and logs to an
  `ai_calls` ledger. Human-in-the-loop, already built.
- The whole hardening layer: RLS helpers, audit events, rate limits, notification
  dead-letters, consent and onboarding, email delivery logging.

**Recommendation: fork the Team Esface backend, rebuild the UI in Gabe's Wild
Wanderers design system, retarget the domain from sport to wellness, and add the
wellness tracking layer that none of the three apps have.** This inherits months
of hardening instead of rebuilding it, and it is the fastest path to a real client
training this season.

What each source gives us:

- **Team Esface:** the entire spine. Surfaces, tenancy, the plan engine,
  milestones and levels, messaging, scheduling, the business OS, the AI pattern,
  and all the security scaffolding.
- **BloomOS (in Ambition Angels):** the admin operating-system patterns and the
  AI next-best-action ideas for the business switch. Much of this already landed
  in Team Esface's `business_os` migrations, so we mostly confirm rather than
  re-port.
- **Trellis:** habit and rhythm logging patterns (`arc_persistent_habits`,
  `arc_weekly_habits`, `pathway_rhythm_logs`), `recharts` for the progress graphs,
  and `next-pwa` so the client app installs on a phone, which matters for daily
  food and workout logging.
- **New, built by us:** the wellness tracking layer. Measurements, food logging,
  activity logging, habits, the wellness score, and check-ins.

---

## 1. The domain model (the bones, your yes goes here)

### Tenancy and the one-profile reality

The `organization` is the boundary. One org now: Wild Wanderers Fitness. Gabe is a
single login who is owner, coach, and business operator at once, so the surface he
sees is capability-based, not a separate account per hat. Retarget the role enum
from `admin, coach, parent, athlete` to `owner, coach, client`, keeping `parent`
available for the youth and family side later.

### Retarget map (reuse, do not rebuild)

| Team Esface | Wild Wanderers | Notes |
|---|---|---|
| organizations | organizations | one org now, white-label ready for resale |
| profiles, roles | profiles, roles | owner / coach / client |
| athletes | clients | the person being coached |
| teams | groups | small-group training, cohorts |
| transformation_plans, plan_days, plan_activities, activity_completions | training plans, workouts, exercises, completions | reuse near-verbatim |
| plan_activity_swaps, comments, plan_focus_requests | same | client requests a focus, swaps an exercise, comments |
| knowledge_base_items | exercise and wellness library | watch/read/do content, retargeted |
| milestone_definitions, athlete_milestones, level_* | progress, badges, streaks | motivation and the kids' badge system both |
| schedule_events, event_rsvps | sessions | next session with Gabe |
| message_threads, messages | coach and client messaging | two-way, realtime, already built |
| game_debriefs + voice edge fn | wellness check-ins | voice or text, structured by AI |
| feed_posts | announcements, optional community | keep light |
| business OS tables | the business switch | customers, leads, revenue, expenses, offerings, tasks, goals |
| camps, campers, camp_* | the boys program management | rosters, attendance, evaluations, group programs |

### New tables (the wellness layer, define and build)

- `measurements`: client_id, taken_at, weight, body measurements (waist, etc.),
  optional body-fat, notes. Drives the progress graphs.
- `food_logs`: client_id, logged_at, meal, food ref, quantity, calories, macros.
  Food data comes from a nutrition API (see architecture), cached locally in
  `food_items`. We do not build a food database.
- `activity_logs`: client_id, logged_at, type, duration, estimated energy, source.
- `habits` and `habit_logs`: the habit definitions Gabe assigns, and the daily
  check-offs, streaks computed from logs. Pattern borrowed from Trellis.
- `wellness_scores`: client_id, computed_at, score, and the component inputs.
  A transparent, motivational progress number, not a medical assessment. See the
  health-data guardrail.
- `check_ins`: periodic client reflection, voice or text, structured by Coach AI,
  surfaced to Gabe.

---

## 2. The three surfaces (feature level)

### A. Gabe's admin and coach side

Two programs behind one switch, because he runs both:

- **Fitness:** the client roster; a per-client profile that pulls together the
  plan, the logs, measurements, the wellness score, messages, and history in one
  place, so Gabe coaches off real data; build and assign training plans, with
  Coach AI as an assist; review food, activity, and habit logs; review check-ins;
  message and schedule.
- **Dads and Kids (the boys program):** roster and cohorts, session schedule,
  attendance, badges and milestones earned, and the reflections from the day.
  This reuses the camp and team modules almost directly. The boys marketing stays
  on the website; the running of the program lives here.

Plus the shared content library (exercises, wellness lessons) and progress
dashboards, per client and across the whole book.

### B. The client side (installable PWA)

- Home: the next session with Gabe, today's workout, today's habits, and a fast
  way to log.
- Training: today's workout, mark complete, swap or comment on an exercise,
  request a focus for next time.
- Tracking: food log (nutrition-API backed, in the spirit of Noom), activity log,
  habit check-offs.
- Profile: measurements over time, the wellness score, progress graphs.
- Messages with Gabe, the schedule, check-ins by voice or text, and the
  badges, streaks, and milestones that keep it motivating.

### C. The business switch (Gabe)

One profile, three modes: Program, Fitness, Business. The business mode gives him:

- A command dashboard: active clients, revenue, retention, what needs attention.
- Clients and a light CRM, with leads and a pipeline fed by the inquiries from
  the fitness page and the boys program.
- Finance: revenue events through Stripe, expenses, and the offerings and
  packages (1:1, small group, wellness coaching, boys tuition). Payroll and
  commissions exist in the schema for when there is a second coach; off for now.
- Tasks and goals, and settings, including the white-label fields for the day a
  second coach comes aboard.

---

## 3. The AI layer, "Coach"

One pattern, reused from Team Esface: an edge function takes input, calls Claude
with a scoped system prompt, returns structured JSON, writes it to the right
tables, notifies, and logs every call to `ai_calls`.

Coach does three things, all scoped and safe:

1. Drafts or adjusts a workout for what the client wants to train today, writing
   into the plan as a draft Gabe approves before it goes live. Human in the loop,
   reusing the existing plan draft-and-approve status.
2. Structures a client's voice or text check-in into something Gabe can read
   fast, exactly the debrief pattern already built.
3. Surfaces patterns from the logged data for Gabe, a next-best-action nudge,
   coach-facing only.

Hard guardrail: Coach handles programming, habits, and summarizing. It does not
give medical, nutrition, or health advice to clients, and it does not diagnose.
Anything that touches a client's body data stays a tool for Gabe to coach with,
not an automated adviser. Every workout it drafts, a human approves.

---

## 4. Architecture and stack

- **Separate app, separate repo.** `github.com/remi-sobo/wildwanderers-app`,
  deployed to `app.wildwanderers.life`. It shares the Wild Wanderers design tokens
  with the marketing site but is its own application. A fresh Supabase project,
  its own database, its own auth.
- **Stack:** Next.js App Router, TypeScript, Tailwind v4, Supabase (Postgres,
  Auth, Storage, Edge Functions, Realtime), Resend, Stripe, Deepgram for voice, a
  nutrition data API for food, recharts for graphs, next-pwa for install, Vercel.
- **Auth and access:** one login. Role plus `org_id` decide the surface and are
  enforced by RLS, forked from Team Esface's helpers. No client can ever see
  another client, and no coach's org can ever see another's, from the first
  migration.
- **Design:** carry Gabe's aesthetic into the app shell, warm bone and forest,
  Fraunces and Jakarta, the contour and ridgeline motifs, but tuned for a working
  tool: denser, calmer, dashboard-legible. Clean and clear is the brief. Do not
  inherit the Team Esface sports UI, only its bones.

### The health-data guardrail (load-bearing, hold hard)

The moment a client logs weight, food, and measurements, we hold sensitive health
information and Gabe coaches off it. He is a certified trainer, not a clinician. So:

- The wellness score is transparent and motivational, built from consistency,
  movement, and habits. It is never framed as a medical or diagnostic assessment,
  and it carries a plain note saying so.
- Consent at onboarding, reusing Team Esface's consent flow, covering what is
  tracked and how it is used.
- Strict RLS on all body and food data, encrypted at rest, with the audit ledger
  recording access.
- No medical claims anywhere in the product or in anything Coach generates.

### Nutrition data (buy, do not build)

Building a food database with calorie and barcode accuracy is a multi-month tar
pit. Use a nutrition API and keep our build on the coaching layer. Candidates to
evaluate at build time: a commercial API like Nutritionix or Edamam for natural
language and barcode lookups, or the free USDA FoodData Central plus Open Food
Facts if we want to avoid per-call cost. Confirm current terms and pricing when we
get there, since these change.

---

## 5. The build plan (rings, each one shippable)

Sequenced so something real works at every stop, and so later rings have the data
and clients that earlier rings create.

- **Ring 0, the shell.** New repo and Supabase project. Fork the Team Esface
  schema, retarget names (clients, groups, plans), switch off the sport-specific
  pieces (film room, game moments) for now, seed one org, wire auth, RLS, and role
  routing, and build the app shell in the Wild Wanderers aesthetic. Verifiable:
  Gabe logs in to an empty coach dashboard, a test client logs in to an empty home.

- **Ring 1, the spine.** The smallest thing that gets one real client training.
  Gabe adds a client, builds and assigns a training plan by hand, the client sees
  today's workout and marks it done, they message, and the next session shows on
  the schedule. Ship this and Gabe has a working coaching tool.

- **Ring 2, the wellness tracker.** The new value none of the source apps have.
  Measurements and progress graphs, habit tracking, the client profile with the
  wellness score, then food and activity logging through the nutrition API. Gabe
  can now coach off real data. Turn on PWA install so clients log from their
  phones.

- **Ring 3, Coach AI.** Workout drafting and adjustment for what a client wants
  today, voice and text check-in structuring, and the coach-facing nudges. All
  human-in-the-loop, all logged.

- **Ring 4, the business switch.** The command dashboard, clients and pipeline fed
  by the website inquiries, offerings and packages, Stripe revenue, expenses,
  tasks, and goals.

- **Ring 5, the boys program and the road to resale.** The dads-and-kids
  management surface (rosters, cohorts, attendance, badges) reusing the camp and
  team modules, the kids' trail-log view on the client side, and the multi-coach
  polish, inviting a second org and exercising the white-label fields, that turns
  this from Gabe's tool into a product.

Each ring is its own spec, phased commits, one change at a time, green build
throughout.

---

## 6. Open decisions and flags (your call before Ring 0)

1. **Multi-tenant now:** confirmed by you, and the schema already supports it at
   low cost. Proceeding unless you say otherwise.
2. **Separate app and repo** from the marketing site, sharing design tokens. My
   recommendation. Confirm.
3. **Fork versus clean start:** fork the Team Esface backend and hardening, but
   rebuild the UI in Gabe's aesthetic. This is the big architecture call and the
   reason the timeline is short. Confirm you are good forking.
4. **The boys program's management lives in this app**, while its marketing stays
   on the website. Confirm.
5. **Coach AI scope:** programming, habits, and summarizing only, never medical or
   nutrition advice to clients, every plan approved by Gabe. Confirm.
6. **Wellness score framing:** motivational and non-medical, visible to the client
   and to Gabe. Confirm.
7. **Ring order after the spine:** tracker, then AI, then business. AI needs data
   to be useful, and the business switch needs clients to exist, so this order is
   deliberate. Confirm or reorder.
8. **Nutrition API:** confirm we buy rather than build, and we will evaluate the
   specific provider and cost at Ring 2.

Give me the yeses on section 1 and section 6, and I will write the Ring 0 spec and
the Claude Code prompt that forks the schema, seeds the org, and stands up the
shell in Gabe's aesthetic.

# Ring 2 — The Wellness Tracker (Wild Wanderers Platform)

The value none of the source apps have. Clients log weight, measurements, habits,
and movement from their phone; Progress shows the graphs and a motivational
wellness score; Gabe coaches off real data on the Fitness surface. Food logging
comes through a nutrition API, not a database we build. The client app installs
as a PWA.

This ring holds sensitive health information, so the health-data guardrails from
CLAUDE.md are load-bearing here and lead the design.

## The health-data guardrails (hold hard, these lead)
- **Wellness score is motivational, never medical.** A transparent progress number
  built from consistency, movement, and habits. It always carries a plain "what
  this means" note saying it is a progress signal, not a health or medical
  assessment. Never a failing grade, never rendered in error-red.
- **Consent before any body or food data is logged.** A clear in-app consent,
  recorded, covering what is tracked and how it is used, captured the first time a
  client opens tracking.
- **Strict RLS on every body and food table**, from the first migration. A client
  reads and writes only their own; owner and coach read within their org; no other
  client, no other org, ever.
- **Access is audited.** Privileged reads and writes of body and food data append
  to a sealed audit ledger (forked from the Team Esface `audit_events` pattern:
  RLS on, zero policies, all grants revoked, service-role only, written
  fire-and-forget through the admin chokepoint; metadata holds field names and
  labels, never values).
- **No medical claims anywhere**, in the product or in anything Coach generates.
- **Encryption at rest:** Supabase encrypts the database at rest by default; we
  rely on that plus strict RLS and the audit ledger for Ring 2 (column-level
  encryption is a later hardening if we decide we need it — decision 3).

## Definition of done
- A client consents, then logs a weight and body measurements, checks off the
  day's habits, and logs an activity, all from their phone.
- Progress shows weight over time, habit streaks, and the wellness score as a warm
  number with its plain note.
- Gabe opens Fitness, picks a client, and sees their measurements, logs, habits,
  and wellness score to coach from.
- Food logging works against the chosen nutrition API, cached in `food_items`
  (decision 1).
- The client app installs as a PWA.
- Every new body/food table has RLS and is covered by an isolation check; access is
  audited; no medical claim or fabricated value ships. `npm run build` and the type
  check pass.

## New tables (all org-scoped; body/food tables are client-owned, strict RLS)

- `consents` — id, org_id, client_id, kind (`health_tracking`), version, granted_at,
  granted_by. One row when a client accepts tracking.
- `measurements` — id, org_id, client_id, taken_at, weight_kg numeric, waist_cm,
  hip_cm, chest_cm, arm_cm, thigh_cm, body_fat_pct numeric, notes, created_at.
  Every metric nullable, log what you have. Drives the progress graphs.
- `habits` — id, org_id, client_id, title, cadence (`daily`/`weekly`),
  target_per_week int, is_active, created_by, created_at. Gabe assigns these.
- `habit_logs` — id, org_id, client_id, habit_id, logged_on date, created_at,
  unique (habit_id, logged_on). The daily check-offs; streaks computed from these.
- `activity_logs` — id, org_id, client_id, logged_at, kind text, duration_minutes,
  estimated_energy_kcal, source (`manual`/`import`), notes.
- `food_items` — id, org_id, external_id, name, brand, serving, calories,
  protein_g, carb_g, fat_g, source, cached_at. The nutrition-API cache. We do not
  build a food database.
- `food_logs` — id, org_id, client_id, logged_at, meal
  (`breakfast`/`lunch`/`dinner`/`snack`), food_item_id, quantity numeric, calories,
  protein_g, carb_g, fat_g, notes.
- `wellness_scores` — id, org_id, client_id, computed_at, score int (0 to 100),
  consistency, movement, habits (the components), inputs jsonb. A transparent
  snapshot; also computed live for display.
- `check_ins` — id, org_id, client_id, created_at, kind (`text`/`voice`), body
  text, voice_url, structured jsonb (filled by Coach AI at Ring 3, null now),
  status. Ring 2 captures them; AI structuring is Ring 3.
- `audit_events` (sealed) — forked verbatim from
  `team-esface-migrations/20260702000001_observability_ledger_audit.sql`.

### RLS shape
- Body/food/check-in tables: client manages own (`client_id = any(current_user_client_id())`
  and org); owner and coach read within org; nobody cross-client or cross-org.
- `habits`: owner and coach manage within org; client reads their own assigned
  habits and manages their own `habit_logs`.
- `consents`: a client inserts and reads their own; staff read within org.
- `food_items` (cache): org members read; writes go through the server (service or
  staff) when caching an API lookup.
- `wellness_scores`: computed server-side (a definer function or the service role);
  client reads their own, staff read within org. Never writable by a client.

## The wellness score (transparent, motivational)
A 0 to 100 number from three components, each 0 to 100, then weighted:
- **Consistency** — share of prescribed workout exercises completed over the recent
  window (from `exercise_completions`).
- **Movement** — logged activity minutes against a simple weekly target.
- **Habits** — habit check-off rate over the window.
Proposed weighting: consistency 0.5, movement 0.25, habits 0.25 (decision 2).
Rendered as a warm ring or big Fraunces numeral in fern-to-amber, with the plain
note and a small breakdown of the three inputs so it is never a black box. A
scheduled or on-write recompute writes a `wellness_scores` snapshot for the trend.

## Surfaces (reuse the left-rail shell)
- **Client Log (`/log`)** becomes the tracking hub: log a weight and measurements,
  check off today's habits, log an activity, log food. Gated behind consent.
- **Client Progress (`/progress`)** shows the graphs (recharts, styled to the
  DESIGN.md data-viz palette: forest/amber/fern, faint bark grid, Fraunces
  numerals) and the wellness score with its note.
- **Coach Fitness (`/fitness`)** becomes the per-client wellness dashboard: pick a
  client, see measurements over time, recent logs, habit adherence, and the
  wellness score. A summary also surfaces on the client's Program page.
- **Consent** — a clear one-time screen the first time a client opens tracking,
  recorded in `consents`.

## Stack additions
- `recharts` for graphs, styled warm per DESIGN.md.
- `next-pwa` (or the App Router manifest + a service worker) for install, with the
  manifest, icons, and offline shell. The client app installs on a phone.
- The nutrition API client + `food_items` caching (decision 1).

## Commit sequence
1. **Migration** — the tables above, RLS and policies, the sealed audit ledger, the
   wellness-score function, seed the demo client's tracking data. Verified in the DB
   with an isolation test.
2. **Consent + Log** — the consent gate; logging weight and measurements, habit
   check-offs, and activity.
3. **Progress** — the graphs and the wellness score with its note.
4. **Coach Fitness** — the per-client wellness dashboard, plus the Program summary.
5. **Food logging** — the nutrition API client, `food_items` cache, and `food_logs`
   (decision 1; can be its own ring, 2b, if we want the core tracker to ship first).
6. **PWA install** and the final pass, extend the demo client, then merge.

Each commit: build green, one change at a time, RLS on every new table, no client
or org reaching another's data, no medical claim or fabricated value, shown before
it lands.

## Decisions to confirm before build
1. **Nutrition API** — (a) USDA FoodData Central + Open Food Facts, free, natural
   for MVP; (b) Nutritionix, paid, best natural-language and barcode UX; or (c)
   defer food logging to Ring 2b and ship the rest first (recommended: build the
   core tracker now, decide the food provider at 2b).
2. **Wellness score weighting** — consistency 0.5 / movement 0.25 / habits 0.25, or
   adjust.
3. **Encryption** — rely on Supabase at-rest encryption plus strict RLS and audit
   (recommended), or add column-level encryption for body data now (heavier).
4. **Measurements set** — weight, waist, hip, chest, arm, thigh, body-fat percent.
   Trim or add?
5. **PWA** — include in Ring 2 per the master spec (recommended), or defer.

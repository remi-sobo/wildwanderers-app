# Ring 4 — The Business Switch (Wild Wanderers Platform)

Gabe's third mode. Program is coaching, Fitness is the wellness data, Business is
running the business: a command dashboard, a light CRM and pipeline, offerings,
revenue and expenses, tasks and goals. One profile, three modes. This is Gabe's
back office, owner-only, and it never touches a client's surface.

We fork the Team Esface business OS (`team-esface-migrations/*business_os_*`),
retargeted from a youth-sport club to a solo wellness coach and simplified: no
permission-set machinery yet (Gabe is the only owner), no payroll or commissions
in the UI (the schema keeps room for a second coach later). Money is involved, so
two guardrails lead.

## The guardrails that lead
- **No fabricated financials, ever.** Revenue, expenses, leads, and customers are
  only ever what Gabe actually enters or Stripe actually reports. The demo client
  is a client-side showcase and never appears here. Business surfaces open empty,
  with clear empty states, until Gabe puts real data in. Seed only the offerings
  catalog, with labeled placeholder prices Gabe sets.
- **Owner-only, from the first migration.** Every business table is org-scoped and
  gated to the `owner` role by RLS. No coach and no client ever reads business
  data. Enforced in the schema, not just the UI.

## Definition of done
- Gabe opens Business and sees a command dashboard: active clients, revenue this
  month, open pipeline value, and what needs his attention, plus his goals with
  progress. Every number traces to a real row; nothing is invented.
- He works a light CRM and pipeline: add a lead, move it through stages, log a
  touch, and convert it to a customer.
- He manages offerings (1:1, small group, wellness coaching, boys tuition) and
  logs revenue and expenses, with revenue able to attribute to a customer and
  offering.
- He keeps tasks (with a pin-for-today) and sets goals the dashboard measures.
- Every business table has owner-only RLS, covered by an isolation check; no
  coach or client can reach it; no fabricated value ships. `npm run build` and the
  type check pass.

## New tables (all org-scoped, owner-only RLS)
- `customers` — the paying person or family: name, email, phone, lifecycle_stage
  (`lead`/`active`/`paused`/`churned`), first_touch_source, lifetime_value_cents
  (rolled from revenue), active_enrollments, notes, optional link to a `clients`
  row. One per email per org.
- `leads` — the pipeline: name, email, phone, source (`website`/`referral`/
  `walk_in`/`social`/`other`), interest (`one_on_one`/`small_group`/`wellness`/
  `boys_program`/`other`), estimated_value_cents, stage (`new`/`contacted`/
  `engaged`/`trial`/`proposal`/`won`/`lost`/`nurture`), next_action,
  next_action_date, lost_reason, closed_at, notes.
- `lead_activities` — a touch on a lead: kind (`call`/`text`/`email`/`in_person`/
  `note`/`stage_change`), content, created_at.
- `offerings` — the catalog: name, kind (`one_on_one`/`small_group`/`wellness`/
  `boys_program`/`other`), price_cents (placeholder until Gabe sets it), cadence
  (`one_time`/`weekly`/`monthly`), is_active, description.
- `revenue_events` — amount_cents, category (mirrors offering kinds plus `other`),
  customer_id, offering_id, description, status (`pending`/`collected`/
  `refunded`), source (`manual`/`stripe`), stripe_payment_intent_id (reserved),
  occurred_at, entered_by.
- `expenses` — amount_cents, category (`facilities`/`equipment`/`software`/
  `marketing`/`travel`/`insurance`/`food`/`other`), vendor, description,
  expense_date, receipt_url, recurring, entered_by.
- `business_tasks` — title, description, category, priority (`urgent`/`high`/
  `medium`/`low`), due_date, pin_today, status (`open`/`in_progress`/`done`/
  `cancelled`), sort_order.
- `business_goals` — name, metric (`revenue_mtd`/`active_clients`/
  `open_pipeline_value`), target_value, period (`2026-07` or `2026`), unique per
  metric+period.

Deferred (schema room, not built this ring): payroll, commissions, a public
website-inquiry ingest endpoint, and the Stripe webhook. Revenue fields carry the
Stripe columns so the ingest drops in later without a migration.

## The command dashboard
Server-computed from real rows, owner-only:
- **Active clients** — count of `clients` with status active.
- **Revenue this month** — sum of `revenue_events` (collected) in the current
  month, with last month for a delta.
- **Open pipeline** — sum of `estimated_value_cents` for leads not won or lost.
- **Needs attention** — leads with a `next_action_date` due or overdue, plus
  tasks pinned for today.
- **Goals** — each `business_goals` row with its live metric and a progress bar.
Rendered dense and calm per DESIGN.md's app-tuning note: this is a working tool.

## Surfaces (owner-only, a Business sub-shell)
- **`/business`** — the command dashboard.
- **`/business/pipeline`** — the CRM and pipeline: leads by stage, add and move a
  lead, log a touch, convert to a customer. Customers list alongside.
- **`/business/finance`** — offerings, revenue, and expenses, with month totals.
- **`/business/tasks`** — tasks (with pin-for-today) and goals.
The Business nav item shows for `owner` only; coaches do not see it.

## Stack additions
- `stripe` types and the revenue schema's Stripe columns (reserved). Manual
  revenue entry ships now; the webhook ingest is a later drop-in (decision 2).
- No new runtime deps required beyond that for the core ring.

## Commit sequence
1. **Migration** — the tables above, owner-only RLS and policies, a dashboard
   rollup helper, and the seeded offerings catalog with placeholder prices.
   Verified in the DB with an isolation check (coach and client see nothing).
2. **Business shell + dashboard** — the owner guard, the Business sub-nav, and the
   command dashboard reading real rows with honest empty states.
3. **Pipeline + CRM** — leads board, add/move/convert, activities, customers.
4. **Finance** — offerings, revenue, expenses, month totals.
5. **Tasks + goals** — tasks with pin-for-today, goals the dashboard measures.
6. **Final pass** — settings and white-label fields note, confirm no fabricated
   value, update the docs, then merge. (No demo-client seeding here; business is
   Gabe's real data.)

Each commit: build green, one change at a time, owner-only RLS on every new table,
no coach or client reaching business data, no fabricated financials, shown before
it lands.

## Decisions locked (2026-07-04)
1. **Business access** — owner-only. Every business table is RLS-gated to the
   owner; coaches and clients never see it.
2. **Stripe** — manual revenue entry ships now; the revenue schema carries the
   Stripe columns, reserved for the webhook ingest as a later 4b. No keys needed.
3. **Payroll and commissions** — deferred, schema room only.
4. **Website inquiry ingest** — deferred; leads are entered by hand for now.
5. **Surface scope** — all four: dashboard, pipeline/CRM, finance, tasks/goals.

## Build status
Shipped in six commits on `claude/ring-0-foundation-shell-r619dg`: the schema
and owner-only RLS with the offerings seed, the business shell and command
dashboard, the pipeline and CRM, finance, tasks and goals, and this final pass.
Owner-only isolation and every write path are verified on the live project (a
client sees zero of every business table). No demo seeding: business is Gabe's
real data, and no financial value is fabricated.

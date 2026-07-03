# Ring 1 — The Spine (Wild Wanderers Platform)

The smallest real thing that gets one client training. Gabe adds a client, builds
and assigns a training plan by hand, the client sees today's workout and marks it
done, they message two ways, and the next session shows up. Ship this and Gabe has
a working coaching tool.

Grounded in the real Team Esface schema (`team-esface-migrations/`). We fork the
plan engine, scheduling, and messaging, retarget sport to wellness, and keep the
hardened RLS. We use the Ring 0 patterns: `org_id` on every row, SECURITY DEFINER
helpers instead of recursive inline subselects, flat role checks, delegation for
child tables.

## Definition of done
- Gabe opens Program, sees his client roster, and adds a client.
- Gabe builds a training plan by hand (title, workouts as days, exercises per
  workout) and activates it for that client.
- The client signs in, Home shows their next session and today's workout, Training
  shows the workout, and they mark it done.
- Coach and client exchange messages, delivered in realtime.
- The client's next session with Gabe shows on Home and on Gabe's schedule.
- RLS proves isolation: no client can read another client's plan, workouts,
  completions, messages, or sessions; no org can read another's. Proven by policy,
  not the UI.
- `npm run build` and the type check pass. RLS on for every new table.

## What we fork and retarget

| Team Esface | Wild Wanderers | Notes |
|---|---|---|
| `transformation_plans` | `training_plans` | one plan per client; drop MBHS pillars, evaluation link, AI fields |
| `plan_days` | `workouts` | a day/session in the plan |
| `plan_activities` | `workout_exercises` | movements: title, sets, reps, rest, load, demo media |
| `activity_completions` | `workout_completions` | client marks a whole workout done (see decision 1) |
| `schedule_events` | `sessions` | the next session with Gabe; 1:1 or group |
| `message_threads` + `messages` | same names | two-way coach and client messaging, realtime |
| `create_plan_atomic`, `activate_plan_atomic` | same names | build a full plan in one transaction; one active plan per client |

Deferred to later rings, do not build now: the exercise/wellness content library
(`workout_exercises.library_item_id` is a nullable FK placeholder), exercise
swaps and comments, focus requests, wellness tracking (Ring 2), Coach AI and plan
draft-and-approve automation (Ring 3, though the `draft`/`active` status flow is
here), the business switch (Ring 4), the boys program (Ring 5).

## Migration — enums, tables, helpers, RLS, realtime

### Enums
- `plan_status` `('draft','active','completed','archived')` — hand-built plans go
  draft to active; `pending_approval` waits for the AI ring.
- `session_kind` `('training','check_in','consult','group')`.
- `exercise_kind` `('strength','cardio','mobility','warmup','cooldown','skill')`.

### Tables (all carry `org_id uuid not null references organizations(id)`)

`training_plans`
- id, org_id, client_id → clients (not null), coach_id → profiles, title text not
  null, goal text, status plan_status default 'draft', start_date date, end_date
  date, duration_weeks int, notes text, created_at, updated_at.
- Partial unique index: one `active` plan per client
  (`create unique index ... on training_plans (client_id) where status='active'`).

`workouts` (was plan_days)
- id, org_id, plan_id → training_plans (on delete cascade, not null), day_number
  int not null, week_number int not null, title text, notes text, created_at.
- `unique (plan_id, day_number)`.

`workout_exercises` (was plan_activities)
- id, org_id, workout_id → workouts (on delete cascade, not null), library_item_id
  uuid null (future exercise library), kind exercise_kind default 'strength',
  title text not null, instructions text, sets int, reps text, rest_seconds int,
  load text, media_url text, sort_order int not null, is_optional boolean default
  false, created_at.

`workout_completions` (was activity_completions)
- id, org_id, workout_id → workouts (not null), client_id → clients (not null),
  completed_at timestamptz default now(), notes text.
- `unique (workout_id, client_id)`.

`sessions` (was schedule_events)
- id, org_id, coach_id → profiles, client_id → clients (null), group_id → groups
  (null), title text not null, kind session_kind default 'training', start_at
  timestamptz not null, end_at timestamptz, location text, notes text,
  is_cancelled boolean default false, created_by → profiles, created_at,
  updated_at. (client_id set for 1:1, group_id for a group class, both null for an
  org-wide event.)

`message_threads`
- id, org_id, coach_id → profiles (not null), client_id → clients (not null),
  last_message_at timestamptz default now(), last_message_preview text,
  created_at. `unique (coach_id, client_id)`.

`messages`
- id, org_id, thread_id → message_threads (on delete cascade, not null),
  sender_id → profiles (not null), sender_role user_role not null, content text
  not null, is_read boolean default false, read_at timestamptz, created_at.
- Index `(thread_id, created_at)`.

### Helper functions (SECURITY DEFINER, stable, pinned search_path, granted to
`authenticated` only) — extend the Ring 0 set
- Reuse `current_user_client_id()` (returns `uuid[]`).
- Add `current_user_group_ids()` returns `uuid[]` — the caller's group ids from
  `client_groups`, mirroring the Ring 0 recursion-safe helper pattern.
- `touch_message_thread()` trigger fn — AFTER INSERT on `messages`, rolls up
  `last_message_at` and `last_message_preview = left(new.content,140)`. Execute
  revoked from everyone (trigger only).
- `mark_thread_messages_read(p_thread_id uuid)` — verifies the caller is the
  thread's coach or client, then marks the other party's unread messages read.
  Lets recipients read-receipt without a write grant on `messages`.

### RPCs (SECURITY INVOKER, so the caller's own RLS governs every write)
- `create_plan_atomic(p_plan jsonb, p_workouts jsonb)` — inserts the plan (status
  forced to `draft`) plus its workouts and exercises in one transaction; returns
  the created ids. Retarget of the Team Esface RPC.
- `activate_plan_atomic(p_plan_id uuid)` — archives the client's other plans and
  sets this one `active` in one transaction, so the one-active-plan index never
  strands a client.

### RLS (enable on all seven tables)
Org isolation on every row. Owner and coach manage; a client reads only their own.
- `training_plans`: staff (owner/coach) manage where `org_id = get_user_org()`;
  client SELECT where `org_id = get_user_org()` and `client_id = any(current_user_client_id())`.
- `workouts`: staff manage where role in (owner,coach) and
  `plan_id in (select id from training_plans)`; client SELECT where role client and
  `plan_id in (select id from training_plans)`. (Delegates to plan visibility,
  which is already role-scoped; non-recursive because plans never reference
  workouts.)
- `workout_exercises`: same delegation, one level down via
  `workout_id in (select id from workouts)`.
- `workout_completions`: client manages own (`client_id = any(current_user_client_id())`
  and org match); staff SELECT within org.
- `sessions`: staff manage within org; client SELECT within org where
  `client_id = any(current_user_client_id())` or
  `group_id = any(current_user_group_ids())` or (both null, an org-wide event).
- `message_threads`: staff (role in owner/coach) manage where
  `coach_id = auth.uid()`; client SELECT where `client_id = any(current_user_client_id())`.
- `messages`: staff INSERT/SELECT on threads they own; client INSERT
  (`sender_id = auth.uid()`, `sender_role='client'`) and SELECT on their own
  threads; nobody UPDATE/DELETE (read receipts only via
  `mark_thread_messages_read`).

### Realtime
`alter publication supabase_realtime add table messages;` so the conversation
updates live for both sides.

## Surfaces and routing (reuse the (app) left-rail shell)

### Coach (Program surface)
- `/program` becomes the **client roster**: a list/table of clients with status
  and their active plan, plus an "Add client" primary action. Adding a client
  creates a `clients` row (name, goal, status); optionally invites a login by
  email (creates the auth user + profile, role client, in the org) so they can
  sign in. (Invite-by-email is decision 3.)
- `/program/clients/[id]` — the client's coaching page: their plan and workouts,
  a link to the conversation, their next session, and a "Build plan" / "Edit plan"
  entry. (Wellness logs and the score arrive at Ring 2.)
- Plan builder — create a `training_plan`, add `workouts` (days), add
  `workout_exercises` per workout, then Activate. Uses `create_plan_atomic` and
  `activate_plan_atomic`.
- `/sessions` (or a panel on the client page) — schedule a session with a client;
  a simple upcoming-sessions list.
- `/messages` — the coach's threads list and the active conversation, realtime.

### Client
- `/home` — the next session with Gabe and today's workout (the workout whose day
  maps to today, or the next incomplete one), with a link into Training. Logs and
  habits are placeholders until Ring 2.
- `/training` — today's workout and its exercises, and a "Mark workout done"
  action writing a `workout_completion`. The plan overview (all workouts) below.
- `/messages` — the conversation with Gabe, realtime.
- `/progress` and `/log` stay encouraging empty states until Ring 2.

## Voice and guardrails
- All copy follows the SOBO voice: warm, direct, no em dashes, no AI-giveaway
  words, never framing the client as broken. Empty and pre-plan states offer the
  next step.
- No wellness/medical claims anywhere (that layer is Ring 2, and even then the
  score is motivational, never diagnostic).
- No fabricated content: real client data is never invented. Only the clearly
  labeled demo client gets sample data.

## Seeding — extend the demo client (standing practice)
Extend `supabase/seed/demo_client.sql`: give Demo Client an active training plan
(a couple of weeks of workouts with real exercises), one upcoming session with
Gabe, and a message thread with a few messages, so Gabe sees a fully built-out,
mid-plan client. Clearly a demo.

## Commit sequence
1. **Migration.** Enums, the seven tables, helpers, the two RPCs, RLS and
   policies, realtime on `messages`. Verifiable in the DB with an isolation test.
2. **Coach — clients and plans.** Roster on `/program`, add-client, the client
   coaching page, and the plan builder (create, add workouts and exercises,
   activate).
3. **Coach — sessions and messaging.** Schedule a session; the threads list and
   realtime conversation.
4. **Client — training and home and messages.** Home (next session, today's
   workout), Training (workout, mark done), the conversation.
5. **Seed the demo client** with a plan, a session, and messages, and a final pass
   so the definition of done is fully met.

Each commit: `npm run build` green, one change at a time, RLS covering every new
table, no client or org able to reach another's data, shown before it lands.

## Decisions to confirm before build
1. **Completion granularity** — mark the whole **workout** done (recommended,
   simplest, matches "sees today's workout and marks it done"), or tick each
   exercise and roll up? Per-exercise is a Ring 2 refinement if we start with the
   workout.
2. **Atomic plan RPC** — use `create_plan_atomic` / `activate_plan_atomic`
   (recommended, robust, one-active-plan guaranteed) versus plain app-side inserts?
3. **Add-client login** — when Gabe adds a client, also invite a login by email
   (recommended, so the client can actually sign in and train), or create just the
   `clients` record now and invite later?
4. **Sessions scope** — Ring 1 does 1:1 client sessions and org-wide; include
   group-class sessions (`group_id`) now, or defer group scheduling?
5. **Nutrition/AI/business** — confirmed out of scope for Ring 1 (Rings 2 to 4).

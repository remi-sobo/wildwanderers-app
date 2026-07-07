# Ring 13 — Closing the Loop: the Drafts Inbox, Plan Conversations, Short Plans, Shared Templates, and Open Messaging

Ring 10 and Ring 11 shipped reusable training and the client's own lane, and
each named what it deliberately left out. This ring closes those four, plus the
messaging upgrade they all quietly depend on: today a conversation can only
begin from the coach's side, from a client's Program page. The five pieces
interlock: the inbox is where client-sent work gathers, plan comments are how
Gabe answers it, short plans and shared templates are what clients build next,
and open messaging is the thread that carries all of it.

Numbered 13 against main as of 2026-07-07: Ring 12 is Alongside (coach
accountability), shipped by parallel work the same day. Two rings have now
collided on numbering mid-build; check main's `CURRENT.md` again before the
first commit of this ring.

## What exists today (verified in code)

- **Drafts** rest per client on `/program/clients/[id]` (`DraftPlansList`,
  `getDraftPlansForClient` in `src/lib/data/plans.ts`). There is no view across
  clients; Gabe visits each client to find waiting work.
- **Messaging** is the Ring 1 fork: `message_threads` is one row per
  `(coach_id, client_id)`, both NOT NULL
  (`supabase/migrations/20260703000002_ring1_spine.sql:105-113`). Staff RLS is
  per-coach (`coach_id = auth.uid()`), clients read and reply into their own
  threads, and **no insert policy on `message_threads` exists for clients**: if
  the coach never opens the conversation, the client has no way to start one.
  Staff can only open one from a client's Program page
  (`openThreadWithClient`, `src/lib/messaging/actions.ts:48`); `/messages` has
  no compose. A client sees "Your coach," never a name, because clients cannot
  read staff profiles (`src/lib/data/messages.ts:22-24`). Guardians (Ring 7
  families, with logins) have no messaging at all.
- **The fork source** (`team-esface-migrations/20260601000002_coach_comms_messages.sql`,
  `20260702000002_messages_two_way.sql`): threads carry a `recipient_type`
  (athlete, parent, both), policies pin sender identity and lean on SECURITY
  DEFINER helpers, and thread creation stayed **coach-only even in the fork**.
  Two-way replies were added; two-way initiation never was. Client-initiated
  threads are therefore new ground, not a port, and are called out as a
  decision below.
- **Self-directed workouts** (Ring 11): single-workout only
  (`create_self_workout_atomic`), `plan_type` already has the reserved `short`
  value, and Gabe's review is a bare "Mark reviewed" stamp with no way to say
  anything about the workout itself.
- **Templates** (Ring 10): staff-only by design, with no client policy at all.
  `plan_templates` + `template_workouts` + `template_workout_exercises`.
- **The comment/swap fork source**
  (`team-esface-migrations/20260601000011_self_directed_training.sql:74-248`):
  `plan_activity_comments` (a comment on a plan or one activity, author-pinned,
  visibility inherited from the plan) and `plan_activity_swaps` (a suggested
  replacement with `pending/accepted/declined`, coach suggests, the owner of
  the plan responds). Ready to retarget.

## The guardrails that lead

- **No client ever sees another client. Binding, everywhere here.** "Send to
  anyone" means anyone *across the line between the org and its people*: staff
  to any client or family, a client or guardian to staff. Never client to
  client, never family to family, no group threads. The recipient picker never
  lists another member.
- **Minimal directory exposure.** For a client to pick a recipient and see
  "Gabe" instead of "Your coach," they need exactly a first name and a role for
  the org's staff, nothing more. One SECURITY DEFINER helper returns that; no
  profiles read policy is widened.
- **Sender identity stays pinned** (fork pattern): `sender_id = auth.uid()` and
  `sender_role` must match the caller's real role in every insert policy, so
  nobody speaks as anybody else.
- **A client's plan lane stays theirs.** Comments and swaps never let a client
  edit a coach plan directly: a swap is applied only through a guarded RPC that
  writes the one agreed exercise row, and only after the client accepts.
- **Templates shared deliberately.** A template reaches clients only when Gabe
  flips it visible, per template, default off. No template auto-leaks.
- **No fabricated content.** No seeded conversations, comments, or templates.

## Phase A — the coach-wide drafts inbox

The Ring 10 spec recommended per-client first, inbox later. Later is now.

- **Data:** `getDraftsAcrossClients()` in `src/lib/data/plans.ts`: all resting
  drafts in the org the coach can see, joined with client names, the same
  filter as the per-client list (coach-initiated drafts plus client-sent
  `pending_review`, never a client's private drafts), newest first, split into
  "waiting on you" (client-sent) and "your drafts."
- **Surface:** `/program/drafts`, linked from the Program header next to
  Templates, with a count badge on the link when anything is waiting
  (client-sent items count first). Each row: client name, title, origin badge
  (Scout drafted / From the client), and the same actions as the per-client
  list (Review, Activate, Discard, or Mark reviewed for client-sent).
- **No schema change.** Staff RLS already spans the org's plans; note that in a
  future multi-coach org this inbox is org-wide, not per-coach, and that split
  is out of scope here.

## Phase B — plan comments and swaps (the review that says something)

Fork `plan_activity_comments` and `plan_activity_swaps`, retargeted.

- **`plan_comments`** (new): `id, org_id, plan_id -> training_plans (cascade),
  workout_exercise_id -> workout_exercises (cascade, nullable = a comment on
  the whole plan), author_id -> profiles, author_role user_role, content,
  created_at, updated_at`. Index on `(plan_id, created_at)`.
- **`plan_swaps`** (new): `id, org_id, plan_id, workout_exercise_id (the row to
  replace), suggested_by -> profiles, suggested_library_item_id ->
  exercise_library (nullable), suggested_title, suggested_prescription (sets,
  reps, load as text, nullable), reason, status swap_status
  ('pending','accepted','declined'), responded_at, created_at`.
- **RLS, the fork's inheritance pattern:** whoever can SELECT the plan can read
  its comments and swaps (the subquery runs under the caller's own
  `training_plans` RLS, so the walls built in Rings 10 and 11 carry over for
  free: a client sees comments only on their own visible plans, staff on the
  org's). Writing: staff and the plan's own client insert comments with sender
  pinned; authors edit and delete their own. Swaps: staff create; the plan's
  client responds (accept or decline) by an UPDATE limited to
  `status`/`responded_at`; staff may withdraw their own pending suggestion.
- **Applying an accepted swap:** `apply_plan_swap(p_swap_id)` RPC, SECURITY
  DEFINER, callable by the plan's client or staff, guarded hard: the swap must
  be `accepted`, applied once, and it rewrites exactly the one
  `workout_exercises` row from the suggestion (title, kind, sets, reps, load,
  media, library link). Audit-logged. This is the one sanctioned path by which
  a swap touches plan content; direct exercise UPDATE policies do not widen.
- **Surfaces:** the coach's builder review and the client detail page gain a
  comments rail per plan; the client's Training page shows comments on their
  plan and their own workouts, and a swap prompt ("Gabe suggests Goblet squat
  in place of Back squat, because ...") with Accept and Not this time. Ring
  11's "Mark reviewed" now sits beside an actual note: Gabe comments on the
  client-sent workout, then marks it reviewed.
- **Not forked:** comment threads for guardians (no plan surface for families),
  and comment editing history. Messaging (Phase E) remains the place for
  anything that is not about one plan.

## Phase C — short multi-day client plans

The `short` third of the fork's `plan_type` shape, already reserved in Ring 11.

- **RPC:** extend the self-directed create path to take multiple days:
  `create_self_plan_atomic(p_title text, p_workouts jsonb)`, same lane
  invariants (client's own row, `initiated_by 'client'`, resting status, coach
  never displaced), each workout day-numbered 1..7, `plan_type` derived: one
  workout is `'workout'`, two or more is `'short'`. Keep
  `create_self_workout_atomic` as a one-day wrapper so nothing breaks.
- **Cap:** 7 days, enforced in the RPC. A client wanting more than a week is a
  conversation with Gabe, not a bigger form.
- **Builder:** `/training/build` gains "Add a day" with the same movement
  picker per day. "My workouts" renders multi-day plans grouped by day with
  the same per-exercise check-off, send-to-coach, delete, and log-as-movement
  per completed day (client-entered minutes, unchanged).
- **No new tables, no RLS change:** the Ring 11 policies already scope the
  whole lane by `initiated_by`, not by day count.

## Phase D — a client starts from one of Gabe's templates

- **Schema:** `plan_templates` gains `is_client_visible boolean not null
  default false`. One new read policy: clients read templates where
  `is_active and is_client_visible`, with the same delegated read on
  `template_workouts` and `template_workout_exercises` scoped to visible
  templates. No client write policy of any kind.
- **Sharing:** the `/program/templates` manage surface gains a "Share with
  clients" toggle per template. Default off, deliberate act on.
- **Client flow:** `/training/build` offers "Start from one of Gabe's
  templates" listing the shared ones. Picking one **prefills the client
  builder** (title, days, movements, suggested sets and reps); the client edits
  and saves through their own lane (Phase C RPC). Nothing is instantiated
  server-side on the coach's paths, so the result is an ordinary self-directed
  plan the client owns, capped at 7 days like any other.
- Templates deeper than 7 days offer their first week, said plainly in the UI.

## Phase E — open messaging: start a conversation, both directions

The upgrade the user asked for by name. Today only the coach can begin, and
only from a client's page.

- **Schema:** generalize the thread's far end. `message_threads.client_id`
  becomes nullable; add `guardian_id uuid references guardians(id) on delete
  cascade` (nullable); `check (num_nonnulls(client_id, guardian_id) = 1)`;
  keep `unique (coach_id, client_id)` and add `unique (coach_id, guardian_id)`.
  One thread per staff-member-and-person pair, one to one, no groups.
- **Directory helper:** `org_staff_directory()` SECURITY DEFINER, returns
  `(id, first_name, role)` for the caller's org's owner and coach rows,
  granted to authenticated. This is the entire staff surface a member ever
  sees: a first name to pick and address. Also fixes the "Your coach" generic
  label in `getThreads`.
- **Guardian helper:** `current_user_guardian_ids()` (definer, mirrors
  `current_user_client_id()`), reading `guardians.user_id = auth.uid()`.
  Verify at build whether Ring 7 already shipped an equivalent; do not create
  a second one if so.
- **RLS:**
  - Clients: a new INSERT policy on `message_threads`: `client_id` their own,
    `guardian_id` null, `coach_id` must be in the org's staff (checked through
    the definer helper). This goes past the fork, which kept creation
    coach-only; decision 2 locks it.
  - Guardians: SELECT and INSERT on threads keyed to their own
    `guardian_id`, and send/read policies on `messages` mirroring the client
    ones with `sender_role = 'parent'` pinned (the role enum keeps `parent`
    for the family side; guardians log in with it).
  - Staff policies extend naturally: their existing `coach_id = auth.uid()`
    wall already covers guardian threads once the column exists.
  - `mark_thread_messages_read` and `touch_message_thread` extend their
    participant checks to guardian threads.
- **Compose, both sides:** `/messages` gains "New message."
  - Staff: pick any client, or any family (guardian), from the org. Opens or
    reuses the pair's thread (extends `openThreadWithClient`; add
    `openThreadWithGuardian`).
  - Client or guardian: pick a staff member from the directory (for Wild
    Wanderers today, that list is Gabe, so it is one warm button: "Message
    Gabe"). Opens or reuses their thread with that person.
- **Names both ways:** staff see the client's or family's name (already do for
  clients; add guardians); members now see the coach's first name from the
  directory helper.
- **Explicitly out:** client-to-client and family-to-family messaging (binding
  guardrail), group threads, broadcast, attachments, and unread push
  notifications. Broadcast ("message all clients") is named for a later ring;
  it changes the fan-out model and deserves its own spec.

## Surfaces summary

- `/program/drafts` (new): the inbox, linked with a count from Program.
- `/program/clients/[id]` and the builder: the comments rail; swap suggest.
- `/training`: comments on the client's plans, swap accept/decline, multi-day
  My workouts.
- `/training/build`: Add a day; Start from one of Gabe's templates.
- `/program/templates`: the Share with clients toggle.
- `/messages`: New message compose for every role; real names both directions.

## Definition of done

- Gabe opens one inbox and sees every resting draft and every client-sent
  workout across clients, and can act from there.
- Gabe comments on a client's plan or workout and suggests a swap; the client
  reads it on Training, replies, accepts or declines; acceptance rewrites
  exactly that exercise, audit-logged. A client comments only on their own
  plans; no client ever reads another client's comments (verified live).
- A client builds a plan of up to 7 days in their own lane; everything Ring 11
  verified still holds (forcing active fails, coach plan undisturbed).
- Gabe shares chosen templates; a client starts from one, edits, and owns the
  result; unshared templates stay invisible to every client (verified live).
- Anyone in the org can start the right conversation: Gabe with any client or
  family, a client or guardian with staff, from /messages. A client cannot
  address another client anywhere. Sender identity cannot be spoofed
  (verified live). Members see Gabe's name; families message like clients do.
- Every new table and column is org-scoped with RLS in its creating migration.
  Build and types green at every commit. No fabricated content.

## Commit sequence

1. **Migration 13.1 — conversations.** `plan_comments`, `plan_swaps`,
   `apply_plan_swap`, RLS. Verified live.
2. **Comments and swaps flow.** The rails on coach and client surfaces, the
   swap prompt, audit on apply.
3. **Drafts inbox.** Data + `/program/drafts` + the badge. No migration.
4. **Migration 13.2 — short plans.** `create_self_plan_atomic` (+ wrapper).
   Verified live.
5. **Client multi-day builder + My workouts by day.**
6. **Migration 13.3 — shared templates.** `is_client_visible` + client read
   policies. Verified live.
7. **Share toggle + client start-from-template prefill.**
8. **Migration 13.4 — open messaging.** Thread generalization, helpers,
   client/guardian policies, RPC extensions. Verified live.
9. **Compose flows + names.** New message for every role, guardian threads,
   directory names.
10. **Final pass.** Copy, `CURRENT.md`, this spec's build status, isolation
    re-verified end to end, push.

## Decisions to lock before build

1. **Who is "anyone."** Staff to any client or family; a client or guardian to
   staff; never member to member (binding guardrail). Families included.
   **Recommend yes on families**: they have logins and a surface since Ring 7,
   and Dads & Kids is the flagship. If families should wait, Phase E ships
   client-side only and the guardian columns still land (cheap now, used later).
2. **Clients starting threads goes past the fork.** Team Esface kept thread
   creation coach-only, even after two-way replies. Opening it is the point of
   this ring, but it is a deliberate divergence from inherited hardening.
   **Recommend yes**, with sender pinning and the directory helper as the
   compensating controls.
3. **Swap acceptance rewrites a live plan row.** Accepting a suggestion edits
   the client's plan (possibly the ACTIVE one) through the guarded RPC.
   **Recommend yes**: that is what a swap is for, the write is one row, agreed
   by both sides, and audit-logged. The alternative (coach applies manually
   after acceptance) doubles the steps for no safety gain.
4. **Template sharing is per-template, default off.** **Recommend confirm.**
5. **Short plan cap at 7 days.** **Recommend confirm.**
6. **One ring or two.** Five phases and four migrations is the largest ring
   since 7. Phases A-D are the training loop; Phase E is messaging with its own
   schema surface. **Recommend building A-D as Ring 13 and E as Ring 14** so
   each merge stays reviewable, in the same split rhythm as Rings 10 and 11.
   Written as one spec per the request; the cut line is drawn so the split is
   free.

## Not in this ring (named so the shape is visible)

- Broadcast and announcements (staff to many), group threads, attachments,
  push notifications for unread messages.
- Per-coach draft inboxes for a multi-coach org (the inbox is org-wide today).
- Comment surfaces for guardians (no family plan surface exists to anchor them).
- Client-visible template *browsing* beyond the builder (a gallery page).

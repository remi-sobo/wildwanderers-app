# Ring 10 — Reusable Training: Templates, Draft Review, and Self-Directed Workouts

Three gaps between the spec and the built product all sit on the same spine (the
Ring 1 `training_plans` / `workouts` / `workout_exercises` tables and the Ring 1.5
`exercise_library`). This ring closes them together because they interlock:

1. **Drafts are not persisted.** The master spec and Ring 3 both describe Scout
   drafting a workout "as a `draft` Gabe approves before it goes live, reusing the
   plan draft-and-approve status" (`WildWanderers_Platform_Master_Spec.md:157-159`,
   `RING3_SPEC.md:19-20, 99`). The build does not do this. `create_plan_atomic`
   forces `status='draft'` and `createAndActivatePlan` immediately calls
   `activate_plan_atomic`, so a draft never rests (`src/lib/coach/actions.ts:116-169`,
   `supabase/migrations/20260703000002_ring1_spine.sql:222-289`). Scout's draft
   lives only in `sessionStorage` (`src/components/coach/CoachDock.tsx:73-76` →
   `src/components/coach/PlanBuilder.tsx:60-95`); refresh the tab and it is gone.
   There is no list of drafts Gabe can come back to.

2. **Clients cannot author their own training.** A client can view an assigned
   plan and check exercises off, nothing more (`src/app/(app)/(client)/training/page.tsx`,
   `src/lib/training/actions.ts:12`). The exercise-library migration left a hook,
   `clients_read_active_exercise_library`, with a comment "for self-directed
   training later" (`supabase/migrations/20260703000003_exercise_library.sql:44-48`),
   but no client route reads the library and no policy lets a client write a plan.

3. **There is no library of reusable workouts.** `exercise_library` is a per-org
   catalog of individual movements (`supabase/migrations/20260703000003_exercise_library.sql:10-27`).
   A workout only ever exists inside one client's plan (`workouts.plan_id NOT NULL`).
   Gabe rebuilds "Foundations week 1" by hand for every client; he cannot save a
   workout or a plan once and reuse it.

## The fork picture (read before writing any migration)

Per `CLAUDE.md`, this is a fork of Team Esface and we do not invent tables that
already exist there. The reference lives at `team-esface-migrations/` (not the
`reference/team-esface-migrations/` path CLAUDE.md names; that directory does not
exist, flag for a docs fix).

- **Self-directed training (gap #2 and #3) has a rich forkable source:**
  `team-esface-migrations/20260601000011_self_directed_training.sql`. It extends
  `transformation_plans` with `initiated_by`, `plan_type`, `coach_approved`/
  `coach_approved_at`/`coach_approved_by`/`coach_feedback`, and the AI
  `ai_generated_content`/`generation_log` columns (lines 40-59), adds a
  `pending_review` plan status (line 65), and ships the athlete/parent INSERT and
  UPDATE RLS (lines 128-176). We fork this, retargeted athlete→client, **with one
  deliberate subtraction** (see guardrails).
- **Templates (gap #3) have no forkable source.** No `*_template` table, no
  `is_template` column, no clone function exists in Team Esface or the app. Net-new,
  built small.
- **Draft/approve statuses:** Team Esface's `plan_status` carries
  `draft, pending_approval, active, completed, archived` plus the added
  `pending_review`. The app deliberately kept a leaner enum
  (`draft, active, completed, archived`, `supabase/migrations/20260703000002_ring1_spine.sql:18`)
  and models approval as the `draft → active` flip. We keep that lean model and add
  only `pending_review` (the one status the self-directed flow needs).

## The guardrails that lead

- **Scout never serves a client. Not softened, tightened.** The Team Esface source
  lets an athlete AI-generate their own workout (`ai_generated_content`,
  `generation_log`). Wild Wanderers does not. `CLAUDE.md` Coach-AI scope: the AI
  "gives no medical, nutrition, or health advice to clients and diagnoses nothing,"
  and "every workout it drafts is approved by Gabe before it goes live." So when we
  fork the self-directed schema, **the client's self-directed builder has no AI
  path at all.** A client assembles a workout by hand from the movement library.
  The `ai_generated`/`generation_log` columns exist only on the coach/Scout draft
  side (gap #2), never wired to a client surface.
- **A client authoring their own workout is a choice, not a prescription.** This
  stays inside the health-data guardrail: the client is choosing movements for
  themselves, the same as logging activity. It is never framed as coaching advice,
  carries no medical claim, and Gabe is not prescribing it. The wellness-score
  "movement" input already rewards activity; a completed self-directed workout
  feeds the same signal, never a new medical number.
- **A draft is never visible to a client.** Today `getPlanForClient` falls back to
  the client's most recent plan of *any* status (`src/lib/data/plans.ts:57-67`), and
  the client read policy allows any own-plan status
  (`supabase/migrations/20260703000002_ring1_spine.sql:336-342`). The moment drafts
  stop auto-activating, a resting `draft` or `pending_review` plan would leak to a
  client who has no active plan. This ring closes that: client-facing reads and the
  client RLS policy exclude `draft` and `pending_review`. Defense in depth, both the
  query and the policy.
- **Tenancy holds from the first migration.** Every new table is `org_id`-scoped
  with RLS in the same migration that creates it. No client sees another client, no
  org sees another org, no client ever reaches a template or another client's
  self-directed workout.
- **No fabricated content.** Templates and the movement library seed only as
  clearly-labeled configuration Gabe edits. No invented plans, no sample clients.

## What already exists (do not rebuild)

- The plan spine: `training_plans`, `workouts`, `workout_exercises`,
  `exercise_completions`, and the RPCs `create_plan_atomic` / `activate_plan_atomic`
  (`supabase/migrations/20260703000002_ring1_spine.sql`). The plan builder UI
  (`src/components/coach/PlanBuilder.tsx`) and its library picker.
- The movement library `exercise_library` and its data layer
  (`src/lib/data/exercises.ts`), already read by the plan builder and by Scout's
  drafter (`src/lib/ai/coach-actions.ts:307-343`).
- Scout's `draftWorkoutPlan` (`src/lib/ai/coach-actions.ts:297-381`), which returns
  a draft shape. We change where its output lands, not how it drafts.
- The client shell and nav (`src/components/shell/Sidebar.tsx:57-69`,
  `src/app/(app)/(client)/`), which the self-directed surface extends.

---

## Phase A — Persisted drafts and a review surface (gap #2)

### Schema
Extend `training_plans` (forking the relevant Team Esface columns, coach side only):
- `initiated_by` — `owner | coach | client`, default `coach`. Fork of Team Esface's
  `initiated_by` (retargeted). Drives the drafts list and the self-directed split.
- `ai_generated boolean default false` and `origin_prompt text` — set when Scout
  drafted the plan, so the drafts list can badge "Scout drafted" and Gabe can see
  the ask it worked from. (Team Esface `ai_generated_content` + a slimmed
  `generation_log`; we keep the ask, drop the token accounting, which already lives
  in the `ai_calls` ledger.)
- `coach_approved_at timestamptz`, `coach_approved_by uuid references profiles(id)`
  — stamped when a draft is activated, an explicit, auditable approval record
  alongside the status flip. Fork of the Team Esface approval columns.
- Add `pending_review` to `plan_status` (`alter type ... add value`), used by
  Phase C. Not required for coach drafts, which rest at `draft`.

### Behavior
- **Stop auto-activating.** Split `createAndActivatePlan` into `savePlanDraft`
  (create only, rests at `draft`) and `activatePlan` (the existing activate step,
  now also stamping `coach_approved_at/by`). The plan builder gets two actions:
  "Save as draft" and "Create and activate."
- **Persist Scout's draft as a row.** `draftWorkoutPlan` (or its caller) writes the
  draft as a `draft` `training_plans` row with `initiated_by` = the coach,
  `ai_generated=true`, `origin_prompt=ask`, instead of stashing it in
  `sessionStorage`. The "review and edit" step opens that saved draft in the builder.
- **Edit a resting draft.** New RPC `update_plan_atomic(p_plan_id, p_plan, p_workouts)`
  that replaces a draft plan's workouts/exercises in one transaction, guarded to
  `status='draft'` (or `pending_review`) so an active plan is never rewritten under a
  client. Pattern forked from `team-esface-migrations/20260611000004_atomic_plan_creation.sql`.
  The plan builder loads an existing draft by id and calls this on save.
- **A Drafts surface.** On each client's Program page, a "Drafts" section lists that
  client's `draft` / `pending_review` plans (title, origin badge, when). Each opens
  in the builder to edit, activates (approve), or is discarded. Optionally a
  coach-wide "Drafts" inbox across clients; recommend per-client first, inbox later.
- **Close the client leak.** `getPlanForClient` and any client-facing plan read
  filter to `status in ('active','completed')`. Tighten `clients_read_own_training_plans`
  to the same, so a resting draft is invisible to the client at the row level too.

### RLS
`staff_manage_training_plans` already covers draft insert/update/delete/activate for
owner and coach (`...ring1_spine.sql:331-334`). Only the client read policy tightens
(above). No new staff policy needed.

---

## Phase B — Reusable templates (gap #3, net-new)

### Decision: dedicated tables, not a flag on the plan tables
Two options were weighed. Option A: `is_template boolean` + nullable `client_id` on
`training_plans`, reusing the builder and RPCs. It reuses more but forces relaxing
`client_id NOT NULL` and the one-active-per-client index on the load-bearing,
client-facing plan table, and every client query and policy would then have to
exclude templates forever. Option B: dedicated tables clients never touch.
**Recommend Option B**, because isolation is the app's first guardrail and dedicated
tables keep the client-facing plan tables and their RLS untouched.

### Schema (new, org-scoped, staff-only)
- `plan_templates` — `id, org_id, title, goal, duration_weeks, notes, created_by,
  is_active, created_at, updated_at`. A saved, client-agnostic plan.
- `template_workouts` — `id, org_id, template_id, day_number, week_number, title,
  notes`. Mirror of `workouts` minus a plan/client.
- `template_workout_exercises` — mirror of `workout_exercises`
  (`library_item_id, kind, title, instructions, sets, reps, rest_seconds, load,
  media_url, sort_order, is_optional`) minus a workout's client binding.
- A single-workout template is just a `plan_templates` row with one
  `template_workout`. This is the "saved workout" as well as the "saved plan"; one
  shape serves both.

### Behavior
- **Save as template.** From the plan builder or a resting draft, "Save as a
  template" writes the current structure into the template tables. Movement links
  (`library_item_id`) carry over.
- **Start from a template.** When building a plan, "Start from a template" lists the
  org's templates and instantiates the chosen one: a `create_plan_atomic` call seeded
  from the template, landing as a `draft` for this client. This is where Phase B
  feeds Phase A, template → draft → review → activate.
- **Manage templates.** A light staff surface to list, rename, and deactivate
  templates (no delete of one in use; deactivate). This is also the first CRUD home
  the movement library never got; consider surfacing `exercise_library` management
  in the same place (movements are seed-only today, no edit UI). Recommend scoping
  movement CRUD as a stretch item, not core to this ring.

### RLS
`plan_templates` and children: `for all` to `owner`/`coach` within `org_id`; no
client policy at all (clients never read templates). Same delegation pattern as
`workouts` → `plan` (`...ring1_spine.sql:345-368`).

---

## Phase C — Self-directed client workouts (gap #2)

Fork `team-esface-migrations/20260601000011_self_directed_training.sql`, retargeted
athlete→client, **without the client AI path.**

### Schema
- The self-directed columns from Phase A (`initiated_by`, `plan_type`) already land
  on `training_plans`. Add `plan_type` — `workout | short | transformation`, default
  `transformation` (fork, line 43-44). A client-built workout is `plan_type='workout'`,
  `initiated_by='client'`.
- Relax `duration_weeks` so a one-session workout fits (fork of lines 30-38): allow
  null. The app's `duration_weeks` is already nullable, so this may be a no-op;
  confirm against the live column.
- **Do not** fork `ai_generated_content`/`generation_log` onto the client path, and
  **do not** fork `athlete_goals`/`has_gym_access`/`available_equipment`/
  `session_duration_minutes` unless a client field needs them. Keep the client path
  minimal: a title and a list of movements from the library.
- Skip `plan_activity_comments` and `plan_activity_swaps` for this ring (coach↔client
  messaging already exists via Ring 1 `message_threads`). Name them here as a possible
  later ring, not built now.

### Behavior
- **A client builder.** A lighter version of the plan builder on the client surface:
  read `exercise_library` (the `clients_read_active_exercise_library` policy already
  allows it), pick movements, set their own sets/reps, name it, save. No Scout, no AI,
  by guardrail.
- **My workouts.** The client `/training` surface gains a "My workouts" section
  beside the coach's assigned plan, listing the client's own `initiated_by='client'`
  workouts, each checkable the same way (reuse `exercise_completions` and
  `setExerciseComplete`, `src/lib/training/actions.ts:12`).
- **Optional: send to coach.** A client may set a self-directed workout to
  `pending_review` to ask Gabe to look. Gabe sees it in the Phase A drafts surface,
  can comment (via existing messaging) and approve. This is opt-in; a client's own
  workout does not require approval to exist or be completed. **Decision to lock**
  (below): default to no-approval-needed, with send-to-coach as the opt-in.
- **Movement credit.** A completed self-directed workout should count toward the
  Ring 2 wellness "movement" input the same as logged activity. Confirm whether
  completion writes an `activity_log` row or the score reads completions directly.

### RLS (fork, retargeted)
- `clients_create_self_directed_plans` — `for insert with check (org_id = get_user_org()
  and get_user_role() = 'client' and initiated_by = 'client' and client_id = any
  (current_user_client_id()))`. Fork of `athletes_create_self_directed_plans`
  (lines 128-135), using the app's existing `current_user_client_id()` helper.
- `clients_update_own_self_directed_plans` — fork of lines 137-148, constrained to
  `initiated_by='client'` and own client id, so a client can never touch a
  coach-authored plan.
- The client read policy from Phase A must now also let a client read their own
  `draft`/`pending_review` **self-directed** rows (their own in-progress workout)
  while still hiding coach-authored drafts. Cleanest cut: clients read own plans
  where `status in ('active','completed')` OR `initiated_by='client'`. Verify this
  split on the live DB, it is the subtle policy in the ring.

---

## Surfaces

- **Coach — `/program/clients/[id]`:** a Drafts section (Phase A); "Start from a
  template" and "Save as a template" in the plan builder (Phase B).
- **Coach — templates:** a light manage-templates surface (Phase B), owner/coach.
- **Client — `/training`:** a "My workouts" section and a "Build a workout" entry
  into a Scout-free client builder (Phase C).
- **Client nav:** no new top-level item needed; "Build a workout" lives inside
  Training.

## Definition of done

- A coach drafts a plan (by hand or with Scout), it rests as a `draft`, appears in
  the client's Drafts list, can be reopened and edited, and only goes live when the
  coach activates it, which stamps who approved and when. No draft is ever visible
  to a client, verified on the live DB.
- A coach saves a plan or a single workout as a template and later starts a new
  client's plan from it, landing as a draft to review.
- A client builds their own workout from the movement library, with no AI anywhere
  in that path, sees it under "My workouts," completes it, and it counts as movement.
  A client can optionally send one to Gabe for review.
- Every new table (`plan_templates` and children) and every new column is
  `org_id`-scoped with RLS in its creating migration. A client cannot read a
  template, another client's self-directed workout, or any coach draft. Verified on
  the live DB (the isolation checks Rings 5–7 established).
- No fabricated content. `npm run build` and the type check pass. Each commit is one
  reversible change.

## Commit sequence

1. **Migration A — drafts.** The `training_plans` columns (`initiated_by`,
   `ai_generated`, `origin_prompt`, `coach_approved_at/by`), the `pending_review`
   status, `update_plan_atomic`, and the tightened client read policy. Isolation
   (no draft leaks to a client) verified in the DB.
2. **Draft flow.** Split save from activate in the builder and actions; persist
   Scout's draft as a row; build the per-client Drafts surface; fix
   `getPlanForClient`.
3. **Migration B — templates.** `plan_templates`, `template_workouts`,
   `template_workout_exercises`, staff-only RLS.
4. **Template flow.** Save-as-template, start-from-template (instantiate → draft),
   the manage-templates surface.
5. **Migration C — self-directed.** `plan_type`, the `duration_weeks` relax if
   needed, and the two client self-directed RLS policies (no AI columns on the
   client path). The read-policy split verified in the DB.
6. **Client builder.** The Scout-free client workout builder, "My workouts" on
   Training, movement credit on completion, optional send-to-coach.
7. **Final pass.** Warm copy, reconcile `CURRENT.md` and the reference-path note in
   `CLAUDE.md`, confirm no fabricated content, confirm Scout is absent from every
   client path, merge.

## Decisions to lock before build

1. **One ring or split?** LOCKED (2026-07-07): Phases A and B build as this ring;
   Phase C (self-directed) splits into its own follow-up ring. Phases A and B are
   coach-side and tightly coupled (template → draft → activate); Phase C is
   client-side with its own guardrail surface, and it stays specified here so the
   follow-up ring starts from this document.
2. **Does a client's self-directed workout need Gabe's approval?** **Recommend no by
   default** (it is the client's own choice, not a prescription), with an opt-in
   "send to coach" that sets `pending_review`. The alternative (all client workouts
   need approval) adds friction and reads as gatekeeping, against the voice rule.
3. **Templates: dedicated tables vs. a flag on `training_plans`.** **Recommend
   dedicated tables** (Phase B) for isolation. Confirm.
4. **Movement credit.** Confirm a completed self-directed workout feeds the Ring 2
   wellness "movement" input, and by which path (an `activity_log` row vs. reading
   completions).
5. **Scout for clients stays off, permanently.** Confirm the guardrail: no AI in the
   client builder, ever. This is the one place the Team Esface source and the Wild
   Wanderers guardrails diverge, and it must be an explicit, recorded decision.
6. **Ring number.** LOCKED (2026-07-07): Ring 10. First numbered Ring 9, but the
   live database already carries a `ring9_movements_media` migration (movements
   ordering plus an exercise-media bucket), applied the same day with no file in
   this repo, so Ring 9 belongs to that in-flight movements work. Renumbered to
   keep the two apart; the git/DB drift itself is flagged in `CURRENT.md` at the
   final pass.

## Build status (2026-07-07)

Phases A and B built in four commits on `claude/client-workout-capabilities-ilmpis`:
the drafts migration (10.1, two files so the enum value and its first use sit in
separate transactions), the draft flow (10.2), the templates migration (10.3),
and the template flow (10.4). All three migrations are applied to the live
project. Isolation verified live: a client sees zero resting drafts (own or
another's), zero rows in all three template tables, and zero of another
client's plans, while their own active plan and workouts read exactly as
before; the owner sees the draft and the template and writes a template
through the RPC under RLS. Test rows were labeled and deleted; nothing
fabricated shipped. Build and type check green at every commit. Phase C
remains specified above, not built. Deviation from the phase-A text: no
coach-wide drafts inbox yet, per its own "per-client first" recommendation.

Phase C built 2026-07-07 as Ring 11, after Ring 10 merged (PR #6). Decisions
taken from this spec: no approval needed for a client's own workout, with
send-to-coach as the opt-in (decision 2); no AI anywhere in the client path
(decision 5); movement credit is a client-entered minutes log through the
existing logActivity path, chosen over an automatic write so no duration is
ever fabricated (decision 4). Additions the build made concrete: a database
guard in activate_plan_atomic so a client-initiated plan can never become the
active plan, client status locked to draft/pending_review at the policy level,
and Mark reviewed (stamping coach_approved_at/by) as the coach's act on a
client-sent workout in place of Activate. plan_activity_comments and swaps
stay unbuilt, as scoped.

## Not in this ring (named so the shape is visible)

- Coach↔client comment threads and activity swaps on a plan
  (`plan_activity_comments`, `plan_activity_swaps` in the Team Esface source) —
  messaging already covers the need; revisit if plan-anchored threads are wanted.
- Client-picks-a-coach-template (a template surfaced to the client's own builder).
- A full CRUD editor for the movement library (still seed-only); candidate stretch
  item alongside the template manager.

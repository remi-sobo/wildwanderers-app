# Spec: Unified tasks, one task system for the whole app

## Problem statement

Gabe runs his day out of two half-systems that do not talk to each other. A
lead carries a free-text "next action" with a date, while real tasks live in
the Business section, and the two can say different things about the same
person. Tasks can only attach to a lead, so there is no way to hang a to-do on
a client, a customer, or the boys program, and there is no one place to see
everything due today. He needs a single task system: every to-do lives in one
table, attaches to the record it is about, can be added from wherever he is
standing (including a quick add), and shows up on one tasks surface that
groups the day for him. The lead's "next action" stops being a separate field
and becomes what it always was, a task.

## Scope

**In:**
- One task model. `business_tasks` grows link columns (`client_id`,
  `customer_id`, `program_id`, keeping `lead_id`), an `assigned_to` staff
  profile, an `is_next_step` flag, recurrence, and auto-generation provenance
  (`source_type`, `dedupe_key`). A new `task_comments` table carries a running
  note thread per task. The table keeps its name; renaming buys nothing.
- **Next action becomes a task.** The `leads.next_action` and
  `next_action_date` columns are migrated (each open lead's text becomes an
  open next-step task) and then dropped. At most one open next-step task per
  lead, enforced by a partial unique index. The lead drawer, the board card,
  and the dashboard attention list all read that task. Completing a next-step
  task in the drawer immediately offers the "set the next one" input, so the
  playbook rule (no lead without a next action) stays enforced by the tool.
- **Staff access.** RLS moves from owner-only to staff: the owner sees and
  manages every task in the org; a coach sees and manages tasks assigned to
  them or created by them. Tasks gain an assignee picker (defaulting to the
  creator). Clients and families never see tasks, verified.
- **A top-level `/tasks` surface** on the staff shell (desktop sidebar item;
  in the More sheet on mobile for now). Groups: Overdue, Today (pinned plus
  due today), This week, Later, and recently Done. Filters by category and by
  linked-record type. Each task shows a link chip (lead, client, customer,
  boys program) that deep-links to the record. Clicking a task opens a task
  popout (same drawer pattern as the lead popout) with details, links,
  comments, recurrence, and complete/reopen. `/business/tasks` redirects to
  `/tasks`; the business dashboard keeps its pinned-today card.
- **Add a task from anywhere.** A quick-add control on the staff shell opens
  a small sheet (title, due date, priority, assignee, optional link), and
  contextual add-task buttons sit on the records themselves: the lead drawer
  (exists today), each client's Program page, each customer row, and the boys
  program page. Context pre-fills the link.
- **Recurring tasks.** A task can repeat daily, weekly, every two weeks, or
  monthly. Completing an occurrence spawns the next one (due date advanced,
  links carried) via a trigger.
- **Auto-generated tasks**, the reference Business OS pattern retargeted, as
  a lazy sweep run when the tasks surface loads (no cron exists):
  1. A lead untouched for 7+ days in a working stage gets "Follow up with
     [name]" (sales, high, assigned to the lead's creator).
  2. A working-stage lead with no open next-step task gets "Set the next step
     for [name]".
  Both dedupe-keyed so a rule never duplicates its own output.

**Out:**
- No client-facing tasks of any kind, and no tasks for parents.
- No reminders, push, or email notifications; the surface and its groupings
  are the reminder for now.
- No subtasks, dependencies, or a kanban view.
- No time tracking or calendar sync; `schedule_events` stays what it is.
- No new auto-generation rules beyond the two above (doc expiry and payroll
  sweeps come with their own rings, as in the reference).
- No AI in the task path.

## Architecture sketch

One migration, one data module, one new surface, three touched surfaces.

    business_tasks (extended)            task_comments (new)
      lead_id ─────► leads                 task_id ─► business_tasks
      client_id ───► clients               content, created_by, created_at
      customer_id ─► customers
      program_id ──► (boys) programs     RLS: owner = all org rows;
      assigned_to ─► profiles                 coach = assigned or created;
      is_next_step, recur, source_type,       client/parent = nothing.
      dedupe_key, updated_at                  Comments ride task visibility.

Data flow:
- `src/lib/data/tasks.ts` (new) is the single reader: grouped lists for
  `/tasks`, per-record task lists for drawers and pages, the next-step task
  per lead. `src/lib/data/business.ts` drops its task readers and its
  attention list re-reads next-step tasks joined to leads.
- `src/lib/tasks/actions.ts` (new) is the single writer: add (with links and
  assignee), edit, complete (recurrence-aware), pin, comment, and
  `setNextStep(leadId, ...)` which closes any prior open next-step task and
  creates the new one. Business and coach actions import from here;
  `addTask` in business actions is retired.
- The recurrence spawn is a database trigger on status → done, so every
  write path gets it for free. The staleness sweep is
  `generate_tasks()` (security definer, staff-gated, dedupe-keyed), called
  by the `/tasks` page load like the reference's lazy sweeps.
- `/tasks` lives in the `(coach)` route group behind `requireOwnerOrCoach`,
  not the owner-only business guard. Nav comes from `shell/nav.ts` so
  sidebar and mobile stay in step.
- Migration order inside one file: add columns and comments table, rewrite
  RLS, convert each open lead's `next_action` into a next-step task, then
  drop the two lead columns. Closed leads' stale next-action text is not
  migrated (their history lives in `lead_activities`).

## Staged build order

Phase 1: **Schema** — the extended task model, comments, staff RLS, the
next-action data migration and column drop, the recurrence trigger, the sweep
function, applied and verified live (client sees zero; coach sees only
assigned-or-created) — commit point.

Phase 2: **Data and actions** — `lib/data/tasks.ts` and `lib/tasks/actions.ts`,
business readers and actions rewired, every `next_action` reference in code
replaced by the next-step task, build green — commit point.

Phase 3: **The `/tasks` surface** — grouped list, filters, link chips, the
task popout with comments, nav entry, `/business/tasks` redirect, sweep wired
to page load — commit point.

Phase 4: **The pipeline merge** — lead drawer shows the next-step task where
"next action" sat (complete-then-set-the-next-one loop), board card and
dashboard attention read it, add-lead form creates it — commit point.

Phase 5: **Add from anywhere** — the shell quick-add sheet, and contextual
add-task on the client Program page, customer rows, and the boys program
page — commit point.

Phase 6: **Final pass** — docs (CURRENT.md, this spec's build status), demo
client untouched (tasks are Gabe's real data, nothing seeded), live
verification recorded — commit point.

## Definition of done

- Gabe adds a task from the shell quick add, from a lead, from a client's
  page, from a customer row, and from the boys program page, and every one of
  them appears on `/tasks` under the right group with the right link chip.
- A lead's next step is a task: setting it from the drawer, seeing it on the
  card and the dashboard attention list, completing it and being asked for
  the next one, all against the same row `/tasks` shows. The old columns are
  gone from the schema and from every component.
- A weekly task completed today reappears due next week with its links
  intact, exactly once.
- A lead left untouched 7 days grows a follow-up task on the next `/tasks`
  load, and reloading does not duplicate it.
- A comment written in the task popout is there on reopen, stamped and
  attributed.
- Simulated-role checks on the live DB: a client reads zero tasks and zero
  comments and cannot insert either; a coach reads only assigned-or-created
  tasks; the owner reads all. `npm run build` and the type check pass at
  every commit point.

## Failure modes to watch for

- **The migration drops next actions it failed to convert.** If the convert
  step misses a lead (null text but a date, odd whitespace), dropping the
  columns destroys the only copy. The migration must convert and verify
  counts in the same transaction: rows with any next-action content equal
  next-step tasks created, checked before the drop runs.
- **A missed `next_action` reader ships broken.** The field is read in the
  drawer, the board card, the dashboard, and the add-lead form. TypeScript
  catches the typed paths only after the `Lead` type drops the fields, so
  Phase 2 must remove them from the type first and chase every compile error
  to zero rather than patching selectively.
- **RLS widening leaks finance detail to a future coach.** Moving from
  owner-only to staff means a coach could be assigned a finance-category task
  and see its title. Acceptable by decision (assignment is Gabe's explicit
  act), but the policies must never let a coach read unassigned org tasks,
  else expense notes in task titles leak wholesale. The isolation check must
  cover exactly this: a coach profile reads zero tasks they neither created
  nor hold.
- **Recurrence runaway.** A trigger that fires on any update to a done task,
  or that copies `status = done` into the spawned row, mints tasks forever.
  The trigger fires only on the transition into done, spawns one open row,
  and the spawned row carries `recur` so the chain continues one step at a
  time. The sweep's dedupe keys guard the generated rules the same way.
- **Two open next-step tasks for one lead.** Race between "complete and set
  next" and a concurrent quick add flagged next-step. The partial unique
  index makes the second write fail loudly instead of silently splitting the
  lead's next step in two; the action surfaces that as "this lead already has
  a next step."

## Build status

Built 2026-08-11 in five commits on `claude/app-business-breakdown-vouj5e`:
the schema pair, the data and action layer, the /tasks surface, add-from-
anywhere, and the final pass. Phases 4 and 5 landed together because the
type change forced the pipeline UI edits into the data commit. The
destructive migration (part 2) applies with the deploy, after the merge,
so live prod code never reads a dropped column. Live verification: client
reads zero tasks and comments; the recurrence chain spawns exactly once
(rolled back); coach isolation is policy-verified only until a coach
account exists. The next-action count check runs inside the part-2
migration itself.

## Decisions locked (2026-08-10)

1. Next action merges into tasks; the lead columns are dropped after data
   migration. One open next-step task per lead, enforced in the schema.
2. Access is staff-wide: owner sees all, a coach sees assigned-or-created.
   Clients and families see nothing.
3. V1 includes due-date grouping with an overdue view, recurring tasks, task
   comments, and the two auto-generation rules. Notifications, subtasks, and
   further rules wait.
4. The surface is top-level `/tasks` on the staff shell; `/business/tasks`
   redirects to it. Mobile reaches it through the More sheet for now.

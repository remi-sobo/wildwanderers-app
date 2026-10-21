# Wild Wanderers: Production Redesign v2, implementation handoff

**The canonical design** is `Wild Wanderers — Production Redesign v2.dc.html`. Everything else in `archive/` is history.

**Prototype parts**
- The shell mounts `GabeApp.dc.html` (one component; `layout` is phone or desktop).
- `GabeApp` mounts `GabeOps.dc.html`, which holds every Business screen and Messages.
- `RemiApp.dc.html` is the advisor workspace.
- `ww-shared.js` is simulated shared state in localStorage.

**What is prototype-only**
- The top bar is prototype-only. It holds the mode switcher, the Weak signal toggle, Flows to try, and Reset.
- All people and numbers are examples.
- There is no backend, no real auth, and no real security.

**Sources**
- Read: `remi-sobo/wildwanderers-app@main` on Oct 20, 2026, specifically `shell/nav.ts`, `BusinessNav.tsx`, `TasksBoard.tsx`, `LeadDrawer.tsx`, the `ProgramDetail.tsx` tab list, and `specs/popup-roll-call.md`.
- Not read line by line: `RollCall.tsx`, `BusinessDashboardView.tsx`, the client-profile components, or the full contents of each ProgramDetail tab. Field-level parity for those must be checked against the code before building.
- Not checked: wildwanderers.life. I did not fetch it this round.

---

## 1. Architecture

```
Sign in ── role ─┬─ owner   → Gabe: Today · Week · Business · Messages (+ capture)
                 ├─ advisor → Remi: Overview · Calls · Work            (NEW role)
                 ├─ coach   → unchanged (Program · Fitness · Dads & Kids · Messages)
                 ├─ client  → unchanged
                 └─ parent  → unchanged
```

**Data:** one record per thing. `business_tasks` is the only task table. `schedule_blocks` is the only calendar. HQ adds views and a few columns. It does not add parallel stores.

## 2. Navigation map

**Gabe, phone.** The bottom bar has **Today · Week · Business · Messages**.
- Capture is a floating amber mic on Today, Week, and Business home. It is not a tab.
- This replaces today's owner tabs (Program · Fitness · Business · Messages, plus More).

**Gabe, desktop.** The same four sit in the left rail, with a Capture button above them.
- Under them is a **Shortcuts** list: Clients, Dads & Kids, Pop-up, Tasks, Schedule, Leads, Numbers.
- Every Business module is reachable from the rail or the Business home.

**Business home (phone and desktop), top to bottom**
1. A Coming up card for the next event.
2. **Quick access**: 4 tiles, editable. Defaults are Clients, Dads & Kids, Pop-up days, Leads. Each tile has a live context line.
3. **Everything else**, grouped:
   - Day to day: Tasks, Schedule, Messages
   - Clients and programs: Clients, Dads & Kids, Fitness, Pop-up days
   - Growing the business: Leads, Numbers
   - Sharing and setup: Library, Alongside, Settings

**Week** contains This Week's Five, Plan my week (with Sort what matters inside), Goals, From last week, and a link to the Schedule.

**Remi.** The three areas are **Overview · Calls · Work**.
- **Calls** holds past calls, Add a call, transcript review, the saved call record, and Prep the call.
- **Work** has three filters: Mine, Gabe's, Waiting on.
  - Mine covers private to-dos, private deliverables, and what I owe Gabe.
  - Gabe's covers assigned and shared work, with status.
  - Waiting on covers questions, approvals, and decisions.

Old URLs stay valid. `/program` and `/fitness` keep working; the owner just reaches them from Business. Add redirects only if a route is renamed. None are renamed here.

## 3. Screen inventory

| Screen | Role | Phone | Desktop | Existing or new | Route / component | Main actions | Depends on |
|---|---|---|---|---|---|---|---|
| Sign in | All | Full screen | Split with photo | Existing | `(auth)` | Sign in, forgot password | Supabase auth |
| Today | Owner | Home tab | Two columns | New | `/today` (new) | Check off, Later, open the linked record, act on From Remi | business_tasks, schedule_blocks |
| Capture | Owner | Full-screen sheet | Centered modal | New | inside `/today` | Record or type, relabel, save, review later | AI chokepoint |
| Week | Owner | Tab | Grid | New | `/week` (new) | See the five, change the plan, let carried items go | week_plans, schedule_blocks |
| Plan my week | Owner | Sheet, 2 steps | Modal | New | `/week` | Pick, Sort what matters, place in blocks | business_tasks.min, quadrant |
| Goals | Owner | Week → Goals | Same | New | `/week/goals` | Edit words, see this week's link | goals (new) |
| Business home | Owner | Tab | Main area | New (replaces `/business` landing for owner) | `/business` | Quick access, directory, edit shortcuts | counts from modules |
| Tasks | Owner, coach | List default | 2–3 column list | Existing, redesigned | `/tasks` · TasksBoard | Add, check, Move, open detail, program filter, Buckets, Timeline | business_tasks, buckets |
| Task detail | Owner, coach | Bottom sheet | Right drawer | Existing, redesigned | TaskDrawer | Done, my three, five, pin, due, priority, link; More: program, goal, repeats, assignee, comments, activity | comments, links |
| Schedule | Owner, coach | Day agenda | Week grid | Existing, redesigned | `/schedule` | Open an appointment, add, move, or resize a work block, mark busy | schedule_blocks |
| Clients | Owner, coach | List | Two columns | Existing, redesigned | `/program` | Needs attention actions, search, filter, add a client | clients, check-ins, drafts |
| Client profile | Owner, coach | Tabs | Same | Existing, regrouped | `/program/[id]` | Next action, review check-in, approve draft, message | existing client data |
| Dads & Kids program | Owner, coach | Stats, People · Sessions · Progress | Same, wider | Existing, regrouped (9 tabs → 3 + subtabs) | `/boys/[program]` · ProgramDetail | Take attendance, add a kid, family detail, form reminders, approve enrollment, award badge, log experience, move adventure | boys tables |
| Leads | Owner | Needs follow-up · Pipeline · All | Same | Existing, refined | `/business/pipeline` · PipelineBoard | Open lead, add lead | leads |
| Lead detail | Owner | Bottom sheet | Right drawer | Existing, reordered | LeadDrawer | Stage, convert, mark lost with reason, next step, log a touch, tasks, details, timeline | lead_activity, business_tasks |
| Numbers | Owner | Tiles and targets | Same | Existing, refined | `/business` dashboard → `/business/numbers` | Drill to clients, pipeline, finance, edit targets | business_goals, finance |
| Finance | Owner | Representative | Same | Existing, unchanged | `/business/finance` | Unchanged | existing |
| Pop-up day | Owner | Roll call · The list | Same | Existing, light polish | `/business/popup/[day]` · RollCall | Mark here, walk-up, waiver QR, filters, day tasks, send location email | popup_* |
| Fitness | Owner, coach | Needs a look and tools | Same | Existing, lightly reordered | `/fitness` | Open the flagged client, manage tools | existing |
| Messages | All | Tab | Rail item | Existing, unchanged workflow | `/messages` | Inbox, thread, send | existing |
| Library | Owner | List | Same | Existing, unchanged | `/library` | Publish a draft, edit the challenge | existing |
| Alongside | Owner, coach | Composer and history | Same | Existing, unchanged | `/alongside` | Share | existing |
| Settings | All | List | Same | Existing, plus an Advisor access section | `/settings` | Advisor share toggles, other settings unchanged | advisor_shares (new) |
| Overview | Advisor | Rail becomes bottom bar | Two columns | New | `/advisor` | Prep, review a call, scan status | shared views |
| Calls, review, record, prep | Advisor | Stacked | Two panes | New | `/advisor/calls/*` | Paste or upload, review in 4 groups, send, prep the agenda | coaching_sessions, session_items |
| Work | Advisor | Filters | Grid | New | `/advisor/work` | Add (private / I owe / assign / suggest), deliverable stages, check own items | advisor_items, business_tasks |

## 4. Feature preservation map

| Live capability | Where it is now | Status |
|---|---|---|
| Owner mobile tabs Program, Fitness, Business, Messages, plus More | Today, Week, Business, Messages. Program becomes Clients in Quick access, Fitness is in the directory | Consolidated. Messages stays a tab |
| More sheet: Schedule, Tasks, Dads & Kids, Library, Alongside, Settings | Business directory, plus desktop Shortcuts | Consolidated |
| Desktop sidebar, owner | Rail: four destinations, then Shortcuts | Refined |
| Coach, client and parent nav (`nav.ts`) | Unchanged | Unchanged |
| Business sub-nav: Dashboard, Pipeline, Pop-up list, Finance, Goals | Numbers (dashboard and goals), Leads (pipeline), Pop-up · The list, Numbers → Finance | Consolidated |
| Tasks: program tabs, Buckets, List, Timeline (phase band) | Tasks: program chips, List (default), Buckets, Timeline | Refined |
| Pin today, overdue-first ordering, due dates, priority, recurrence, assignee, comments, links, next step | Task detail and rows. Pins keep their meaning and show as a pin icon. They do not feed "my three" | Preserved |
| Quick add with program and bucket | Add bar with Program, Due, and Link chips | Refined |
| Schedule grid, recurring sessions | Desktop week grid, phone day agenda | Refined |
| Work blocks with tasks (`schedule_block_tasks`), rollover | Work blocks in Schedule, Make room in Plan my week | Preserved, plus a new entry point |
| Program, client profiles, plans, drafts, check-ins, homework, assessments | Clients and the client profile (Overview, Training, Progress, Details) | Regrouped. **Verify field parity** |
| ProgramDetail 9 tabs | People (Families, Roster, Enrollment, Forms), Sessions (Schedule, Attendance), Progress (Badges, Experiences, Adventure) | Regrouped |
| LeadDrawer: stage, convert, lost reason, next step, Scout first reply, details, tasks, timeline, touch kinds | Lead detail, same pieces with next step and touch first. **First reply (Scout) panel must stay**: it is not drawn in the prototype and sits under Next step | Refined |
| Pop-up roll call: attendance, walk-ups, came with, waivers | Pop-up day | Preserved, light polish |
| Fitness: wellness, assessments, movements | Fitness | Preserved |
| Messages | Messages tab | Unchanged |
| Library, Alongside | Business directory | Unchanged |
| Settings, invite a coach | Settings | Unchanged, plus Advisor access |
| Coach AI dock, voice check-ins | Unchanged. Capture reuses the pipeline | Linked |
| Business goals (metric) | Numbers → Business targets, each with an optional linked Q4 goal | Preserved and connected |

Needs further review: Business dashboard attention items (I did not read the component), the full client-profile sub-screens, and Experiences and Adventure data shapes.

## 5. Change log from Final Design

**Navigation**
- The phone gets Messages as a tab. Capture moves to a floating button.
- The desktop rail gains Messages and Shortcuts.
- Remi's Next call moves into Calls.
- Work filters drop from six to three.

**HQ**
- Today's schedule now reads from the same blocks as Schedule.
- Every task on Today opens something: its linked record, or the task in Tasks.
- "Add to this week" on a Remi assignment puts it in the five.
- Plan my week candidates are real tasks, not a separate list.
- Work time is calculated from the blocks.

**New or redesigned operational screens**
- Business home, Tasks, task detail, Schedule, Clients, client profile, Dads & Kids, Leads, lead detail, Numbers, Pop-up, Fitness, Messages, Library, Alongside, Settings.
- These replace the earlier "existing screen" placeholder cards.

**Advisor**
- Review shows 4 groups (For Gabe, For me, What we decided, Other notes) with inline flags: Already in the app, Possibly done, Needs clarification, Idea, Goal.
- Work: Mine · Gabe's · Waiting on.
- The agenda reflects completed work.
- The access list reads Gabe's share toggles.
- Client-linked tasks are masked for Remi.

**Visual**
- One set of button, chip, sheet and drawer patterns everywhere.
- Bottom sheets on phone, right drawers on desktop.
- The ochre "check this" state is used consistently.
- Touch targets are 44px or more.

**Functional**
- Simulated failed saves: "Not saved · Retry". Attendance and messages keep the input on failure.
- Clash detection when moving work blocks.
- Busy time you add reduces work time.

## 6. Task and schedule rules

1. **One task, many views.**
   - Today's three, This Week's Five, Tasks, a lead's next step, a client task, and a pop-up day's tasks are all the same `business_tasks` row.
   - Checking a task anywhere checks it everywhere. The prototype shows this with the Dana review, the medical-form reminder, and the location email.
2. **My three** is a new per-day pointer: `day_focus(date, task_id, position)`.
   - It is **not** `pin_today`. Pins keep their current meaning and ordering.
   - Limit three. Adding a fourth says "Today already has three. Take one off first."
3. **The five** is `week_plans(week_start, task_id, position, block_id?)`.
   - Placing a task writes `schedule_block_tasks`. "Leave open" writes no block.
4. **Assignments.** New `business_tasks` columns: `assigned_by` (advisor profile), `kind` (`task | assignment | suggestion`), `source_session_item_id`, and `goal_id`.
   - A suggestion only becomes a normal task when Gabe accepts it.
5. **Work time** = the sum of work blocks from now to Sunday, minus overlapping busy holds.
   - Open time is never counted. If a calendar source is missing, the time is not treated as free.
   - Fixed sessions, programs, events and family time are never moved automatically.
   - Moving a work block into a fixed item is refused with the item's name.
6. **Moving and rescheduling.**
   - Fixed items say "Reschedule it from the session itself so the client or family gets told."
   - Work blocks move by day, by 30-minute nudges, or by length.
7. **Overload** shows as "Over by 45m" on a block, and on Week as "That is 2h more than fits". Nothing is moved for him.

## 7. Advisor role and permissions

- **A new `advisor` role.** It is never `coach`. It is scoped by `advisor_relationships(advisor_id, owner_org_id)` and `advisor_shares` (goals, five, tasks, schedule, numbers), which Gabe toggles in Settings.
- **Advisor can read:**
  - shared goals and the five
  - tasks Remi assigned or Gabe shared
  - work blocks as time only, with no attendee names
  - pop-up counts
  - numbers as counts, and only if shared
  - all coaching calls and transcripts, plus his own advisor items
- **Advisor can never read:** clients, wellness, check-ins, kids, families, forms, messages, Gabe's private ideas, or finance detail.
- **Masking.** A task linked to a client shows to the advisor as "A client task · details not shared with you".
- **Advisor can write:** advisor items, assignments and suggestions to Gabe, and comments on shared tasks. He cannot edit Gabe's other tasks.
- **Remi's private items** (`vis = private`) are never readable by the owner.
- **RLS on every new table from the first migration.** Verify with simulated roles:
  - advisor reads 0 rows from client, wellness, youth and message tables
  - coach, client and parent read 0 advisor rows

## 8. Transcript to action

1. Paste or upload a transcript. It is attached to a session and private to the advisor.
2. Extraction proposes `session_items`, each with a kind, text, owner (gabe, remi, or unclear), due date (only if said), and source quote with timestamp.
3. **Matching.** Each proposal is compared with open tasks and advisor items. A match is linked, never duplicated. Work already done is tagged "Possibly done".
4. **Review.** Four groups with inline flags. Remi can accept, edit, remove, change owner, choose assign or suggest, change the date, keep it private, or turn an idea into a task.
5. **Send.** A preview shows "what Gabe will see". Only accepted For Gabe items are published. Personal parts of the call never become items.
6. **Status flows back** through the task's activity: done, moved, asked. The next-call agenda is built from open and finished items and can be edited.

## 9. Data dependencies

**Reused**
- `business_tasks` (pin_today, due_date, priority, program, bucket_id, assigned_to, recur, is_next_step, links)
- `task_comments`, `task_buckets`
- `schedule_blocks`, `schedule_block_tasks`
- `leads`, `lead_activities`, `business_goals`, finance tables
- `popup_*`
- boys program tables
- clients, plans, check-ins
- messages
- the AI chokepoint, Deepgram, Scout first reply

**New**
- `day_focus`, `week_plans`, `goals`
- `advisor_relationships`, `advisor_shares`, `advisor_items`
- `coaching_sessions`, `session_items`
- the new task columns from §6.4
- `schedule_blocks.kind = hold`, if that kind does not exist yet

**UI only:** Business home, the phone tab bar, the desktop rail, Tasks layout, Schedule agenda, client-profile grouping, ProgramDetail grouping, lead-detail order, the Numbers layout.

## 10. Per-module notes

**Tasks (`/tasks`, TasksBoard, TaskDrawer)**
- Changes: List becomes the default (it was Buckets). Rows are grouped Needs attention, Coming up this week, Later. Rows get an inline Move action. The detail drawer uses progressive disclosure.
- Unchanged: the ordering rule, pins, the phase band, buckets.
- Backend: none, beyond the §6 columns.
- Edge cases: undated tasks go to Later, and are listed under Undated in Timeline. An empty bucket says so.
- Risk: someone used to Buckets as the default view.

**Schedule (`/schedule`)**
- Changes: a phone day agenda, kind legend and styling, a work-time card, a "Something's not on here" busy hold, clash checks.
- Unchanged: recurring sessions and how they are edited.
- Backend: the hold kind.
- Risk: miscounted availability. Count only work blocks.

**Clients (`/program`)**
- Changes: Needs attention (check-ins, drafts, quiet clients), Upcoming sessions, then the list. The profile gets four tabs with a Next banner.
- Backend: none, if check-in and draft states exist. **Verify.** Don't invent an approval flow if drafts don't have one.

**Dads & Kids (`/boys`, ProgramDetail)**
- Changes: the stats row is tappable, Take attendance is one tap, a missing-form banner, Add a kid (existing or new family, with invite).
- All 9 capabilities are kept as subtabs.
- Risk: deep links to the old `?tab=` values. Map them to the new section and subtab.

**Leads (`/business/pipeline`, LeadDrawer)**
- Changes: Needs follow-up becomes the default queue. The drawer order is stage, next step, log a touch, tasks, details, timeline.
- Preserved: convert, lost reason, first reply, every field.

**Numbers (`/business`)**
- Changes: four tiles (revenue, active clients, open leads, follow-ups due) and targets with an optional linked Q4 goal.
- Finance is unchanged.

**Pop-up (`/business/popup`)**
- Changes: four counts, filter chips, the Mark here button size.
- Everything else matches the roll-call spec.

## 11. Required states

| State | Behavior |
|---|---|
| Empty | Each list says what to do next ("Nothing open in this bucket. Add the next piece of work above.") |
| Too many tasks for today | The three is capped and says so. Tasks Needs attention can be long; that's fine |
| Overdue | Ochre "overdue, was Oct 16", no red counts |
| Overloaded block or week | "Over by", "That is 2h more than fits" |
| Client needs you, lead needs follow-up | Context lines on Quick access, badges in the directory |
| Missing form | Ochre row text and a banner with Send reminder |
| Walk-ups | Count, a "Walk-up" tag, and waiver state |
| Already done | Struck through. The review flags "Possibly done" |
| Duplicate suggestions | "Already in the app", linked to the existing task |
| Uncertain owner | "Needs clarification", owner "Not sure", nothing sent |
| Overdue deliverable | "Was due Oct 16. Move it or mark it done?" |
| Gabe moves an assigned task | Remi sees "Moved to …" |
| Away for days | Today shows today. Carried items go to Week · From last week |
| **Failed save** | The row is not changed, shows "Not saved · Retry", and a toast. Attendance and messages keep the input |
| Weak connection | A banner. Each action reports on its own |
| Advisor reaches something not shared | Masked title, plus "Locked" in Settings |
| Loading | Skeleton rows in each card's shape. Never a blank screen |

## 12. Implementation order (each step can be reversed)

0. Feature flag `owner_hq` per user. The flag off gives back today's owner nav exactly.
1. Advisor role, shares and RLS. Verify with simulated roles. Nothing is visible to Gabe yet.
2. Remi Work and assignments, plus Gabe's From Remi on the existing Tasks screen.
3. Today and the new owner tab bar, behind the flag. Add `day_focus`.
4. Calls: paste a transcript, review, match, send. Then the call record and Prep.
5. Week: the five, Make room, Sort what matters. Work time from blocks, plus busy holds.
6. Business home and the Tasks redesign. Then Schedule.
7. Clients, Dads & Kids and Leads regrouping. Pure UI, one module per release.
8. Numbers and targets linked to goals. Capture through the chokepoint.

## 13. Regression checklist

- Coach, client and parent nav and homes are byte-for-byte unchanged.
- An existing `pin_today` task still pins, sorts and shows on `/tasks`.
- A lead next step created in the LeadDrawer still appears in Tasks and on the lead.
- Convert to customer and Mark lost with a reason still work. The first-reply draft still appears.
- Roll call works offline-tolerant, as in its spec: mark here, walk-up, came with, waiver.
- Every one of the 9 ProgramDetail capabilities is reachable and saves.
- Recurring schedule edits still regenerate correctly. No fixed block moves without an explicit edit.
- `schedule_block_tasks` rollover still runs.
- Advisor RLS: zero rows from the sensitive tables. The masked title is shown on client-linked tasks.
- A failed save never shows as saved.
- With the flag off, the owner app is identical to production.

## 14. Unresolved assumptions

- Gabe's fixed week and work blocks are seeded from the Aug 31 and Oct 19 calls, not live `schedule_blocks`.
- Check-in review, plan-draft approval, and homework exist as described. Verify before building.
- Experiences and Adventure stages are a representative shape.
- Whether "no AI in the task path" can become "AI suggests, a person creates". This needs Gabe's yes.
- Transcript retention, who can delete one, and whether Gabe sees transcripts or only summaries.
- Default Quick access tiles are a guess with no usage data. They can be rearranged in the app.
- Revenue figures are not shown in the prototype on purpose.
- I did not check the live website in this round.

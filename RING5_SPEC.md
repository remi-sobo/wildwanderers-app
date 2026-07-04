# Ring 5 — The Boys Program ("Dads & Kids") (Wild Wanderers Platform)

Running the boys program, the way a nonprofit runs an after-school program, minus
the impact, evaluation, and fundraising machinery. This ring is the operational
back office for the program: the programs themselves, cohorts, the roster of kids
and their parents, the session schedule, attendance, and a light badge for
motivation. The boys marketing stays on the website; the running of the program
lives here.

We fork the Team Esface camp module (`team-esface-migrations/*camp*`),
retargeted: camps become programs, camp_groups become cohorts, campers become
participants, camp_schedule_events become sessions, camp_attendance stays
attendance. We deliberately drop the camp_evaluations scoring engine, the
milestone-definition machinery, and anything impact or fundraising, per the
brief. Kids are minors with no logins now; the `parent` role stays reserved for
the family-facing view later.

## The guardrails that lead
- **Kids are minors; handle their data with care.** Participant records and
  parent contact are org-scoped and staff-only (owner and coach) from the first
  migration. No client, and no participant, reads this data. A participant has no
  login this ring.
- **No fabricated content.** Programs and participants are only ever what Gabe
  enters. The surface opens empty. We seed only a small badge catalog, which is
  configuration, clearly named, not a fabricated result.
- **No evaluation or scoring.** This is program operations, not assessment. No
  skill grades, no impact metrics, no fundraising. A badge is a warm "showed up
  and did well," never a score.

## Definition of done
- Gabe creates a program (name, dates, location), adds cohorts, and builds the
  roster: each kid with their parent's name and contact, assigned to a cohort.
- He builds the session schedule and takes attendance for a session, marking each
  kid present, absent, or late.
- He awards a badge to a kid from a small catalog, with an optional note.
- A program overview shows the roster count, the next session, and attendance at
  a glance.
- Every table is staff-only and org-scoped, covered by an isolation check (a
  client sees none of it). No fabricated kids, no evaluation. `npm run build` and
  the type check pass.

## New tables (all org-scoped, staff-only RLS: owner and coach)
- `programs` — id, org_id, name, status (`setup`/`active`/`completed`/
  `archived`), location, start_date, end_date, description, created_at.
- `program_groups` — the cohorts: id, program_id, name, color.
- `program_coaches` — staffing: id, program_id, coach_id, group_id, role
  (`lead`/`coach`). Gabe is lead now; this holds a second coach later.
- `participants` — the kids: id, org_id, program_id, group_id, first_name,
  last_name, grade (1 to 12), parent_name, parent_email, parent_phone, photo_url,
  status (`active`/`inactive`), notes. No login; managed by staff.
- `program_sessions` — the schedule: id, org_id, program_id, group_id, title,
  location, starts_at, ends_at.
- `attendance` — id, org_id, program_id, session_id, participant_id, status
  (`present`/`absent`/`late`), marked_by, unique (session_id, participant_id).
- `program_badges` — the catalog: id, org_id, name, emoji, description,
  sort_order. Seeded with a warm starter set.
- `participant_badges` — awards: id, org_id, participant_id, badge_id, note,
  awarded_by, awarded_at.

## Surfaces (a Dads & Kids sub-shell, owner and coach)
- **`/boys`** — the programs list, with a create-program action and a per-program
  overview card (roster count, next session, status).
- **`/boys/[id]`** — one program, with sections:
  - **Roster** — participants grouped by cohort; add a participant, add a cohort,
    move a kid between cohorts.
  - **Schedule** — the program's sessions; add a session.
  - **Attendance** — pick a session, mark each kid present, absent, or late, with
    a quick all-present.
  - **Badges** — award a badge to a kid from the catalog, and see who has what.
- Nav: a "Dads & Kids" item on the coach shell, for owner and coach. (The
  family-facing kids' trail-log view is a later pass, decision 1.)

## Commit sequence
1. **Migration** — the tables above, staff-only RLS and policies, the seeded badge
   catalog, verified in the DB with an isolation check (a client sees nothing).
2. **Programs + the Dads & Kids shell** — the nav item, the programs list and
   create, and the program overview.
3. **Roster + cohorts** — add participants and cohorts, group the roster, move a
   kid between cohorts.
4. **Schedule + attendance** — add sessions, and mark attendance per session with
   a quick all-present.
5. **Badges + final pass** — the badge award and roll-up, confirm no fabricated
   content or evaluation, update the docs, then merge.

Each commit: build green, one change at a time, staff-only RLS on every new table,
no client reaching program data, no fabricated kids and no evaluation, shown
before it lands.

## Decisions locked (2026-07-04)
1. **Family-facing view** — built this ring. Parents get a read-only view of their
   own kids' schedule, attendance, and badges, behind an invite-and-login flow.
2. **Badges** — included. A light motivational award from a seeded catalog.
3. **Who runs it** — owner and coach both manage the program.
4. **Resale and white-label** — folded in. The owner edits the org's name, logo,
   and brand colors, and invites a second coach, the first step toward resale.

## Build status
Shipped in six commits on `claude/ring-0-foundation-shell-r619dg`: the schema
with staff and parent RLS and the badge seed, the Dads & Kids shell and programs
list, the program detail (roster, schedule, attendance, badges), the
family-facing view, the white-label settings and coach invite, and this final
pass. Staff isolation, the full write path, and parent isolation (a parent sees
only their own child) are all verified on the live project. No fabricated kids:
the only seed is the badge catalog. Inviting a family or a coach needs the
server key; the rest works regardless.

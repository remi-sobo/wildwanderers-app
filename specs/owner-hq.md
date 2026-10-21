# Owner HQ: the new owner layout (Phase 0 and 1, as built)

The approved redesign (`Wild Wanderers App(3).zip`, Production Redesign v2)
gives the owner Today, Week, Business and Messages, with everything else one
tap away. This is the first slice, built behind a flag so production stays
exactly as it is until the owner turns it on.

## The flag

`OWNER_HQ`, per deployment:

| Value | Effect |
|---|---|
| unset, `off`, anything else | Classic layout for everyone. Settings shows no Layout card. |
| `optin` | Classic by default. The owner sees a Layout card on Settings: "Try the new layout" / "Back to the classic layout". |
| `on` | New layout for the owner, who can switch back on Settings. |

The owner's choice is an httpOnly cookie on that device (`ww_owner_hq`).
Only the owner role is ever affected; the rule is in
`src/lib/flags/owner-hq-rule.ts` with tests. The flag changes navigation and
the owner's landing page only. It never changes what anyone can read or
write.

**Rollback:** unset `OWNER_HQ` and redeploy (everyone back to classic at
once), or the owner taps "Back to the classic layout". No migrations are
involved in this slice.

## What the owner gets with the flag on

- **Phone:** tabs Today, Week, Business, Messages. No More sheet.
- **Desktop rail:** the same four, then Shortcuts (Clients, Dads & Kids,
  Pop-up days, Tasks, Schedule, Leads, Numbers), then account and sign-out.
- **Landing:** `/today` after sign-in.
- **Today** (`/today`): pinned tasks (`pin_today`, unchanged meaning), tasks
  due today or overdue, and today's schedule blocks plus booked sessions.
  Check off and unpin use the existing task actions. A row changes only after
  the save succeeds.
- **Week:** opens `/schedule` until the planned `/week` page exists.
- **Business** (`/business`): Coming up, four editable Quick access tiles
  (saved on the device), and the directory in four groups. Account and
  sign-out sit at the foot on phone.
- **Numbers** (`/business/numbers`): the old dashboard, same component.
  The sub-nav reads Numbers, Pipeline, Pop-up list, Finance, Goals.

Every link is an existing route. Nothing is renamed, so old URLs and
bookmarks keep working. Coach, client and parent see no change.

## Where each classic owner item went

| Classic | New layout |
|---|---|
| Program tab | Quick access Clients, Shortcut Clients, directory |
| Fitness tab | Directory |
| Business tab (dashboard) | Numbers (Shortcut, directory, sub-nav) |
| Messages tab | Messages tab |
| More: Schedule, Tasks | Week tab, Shortcuts, directory |
| More: Dads & Kids | Quick access, Shortcut, directory |
| More: Library, Alongside, Settings | Directory |
| More: account, sign-out | Desktop rail; foot of Business on phone |

`src/lib/hq/business-home.test.ts` fails if any classic owner destination
becomes unreachable.

## Still design-only (not built)

My three, This Week's Five, Plan my week, Goals, From Remi, Capture, work-time
math, busy holds, Numbers targets linked to goals, every advisor screen. Each
needs new tables or a decision; see the plan's later phases.

Live lines on Business show only verified data: plans to review, lead
follow-ups due plus new inquiries, tasks due, next session and pop-up dates.
Check-in review state, unread messages and missing forms show plain hints
until their sources are confirmed.

## Smoke checklist (run on a preview, flag off, then flag on)

Flag off: everything must match production.

- [ ] Owner, coach, client and parent menus and landing pages unchanged.
- [ ] `/business` is the dashboard; `/business/numbers` sends to `/business`.
- [ ] Settings shows no Layout card (with `OWNER_HQ` unset).

Flag on (owner):

- [ ] Sign in lands on Today; phone tabs and desktop rail as above.
- [ ] Every Shortcut, tile and directory row opens its page.
- [ ] Today: check off a pinned task, a due task, a recurring task (the next
      one appears in /tasks once). Unpin a task. Each shows in /tasks.
- [ ] Today's schedule matches /schedule for the same weekday.
- [ ] Quick access: reorder, remove, add; reload keeps the order.
- [ ] Numbers: same figures as the classic dashboard.
- [ ] Settings: "Back to the classic layout" restores classic at once.
- [ ] Coach, client, parent: no change, even with the cookie copied in.

Regression, any layout:

- [ ] Task pin, due ordering, recurrence, buckets, Timeline on /tasks.
- [ ] Lead next step from LeadDrawer shows in Tasks; convert, mark lost with
      a reason, first reply draft.
- [ ] Pop-up roll call: mark here, walk-up, came with, waiver QR.
- [ ] All nine Dads & Kids tabs open and save.
- [ ] Schedule drag, resize, edit; work-block task rollover.
- [ ] Client check-ins, plan drafts, messages.

## Known limits

- The device clock decides "today" (no org timezone column exists); this
  matches the Schedule grid.
- Schedule blocks marked every other week, monthly or one time show every
  week, as they do on the Schedule grid today; Today labels them.
- Screenshots in this round used fixture data on a local page; a preview
  with a real owner login is still needed for real-data screenshots.

## Findings recorded, not changed here

- `profiles` role and org self-assignment: confirmed live in production
  (authenticated held UPDATE on `role` and `org_id`, no guard). Fixed by
  `20261021000001_profiles_guard_privileged.sql`, applied to production on
  2026-10-21 and verified there: a real client's self-promotion is refused
  inside a rolled-back transaction.
- Reopening and re-completing a recurring task spawns a second next task.
- `generate_tasks()` is security definer and lets a coach trigger org-wide
  inserts.
- Deepgram transcription is not logged to `ai_calls`.
- Several parent RLS policies have no `org_id` check.
- `ring7_boys_completions` uses `substr(x from n)`, rejected by Postgres 16.
- `npm run lint` has no ESLint config.

# Week: My three and This Week's Five (Phase 4a, as built)

Part of the owner HQ layout (`specs/owner-hq.md`). Both are pointers to real
`business_tasks` rows, so checking a task off anywhere checks it off here.
One-day schedule overrides are Phase 4b and ship separately, because they
change the live Schedule grid.

## Decisions (2026-10-22, the owner's go-ahead on these recommendations)

- **This Week's Five:** an empty week offers a starting five that the owner
  edits ("Use these" or "Pick my own"). The app never decides for them.
- **My three:** yesterday's open picks show as "From yesterday" with "Pick
  again". Nothing carries over silently.
- **One-day schedule moves** (4b): a drag defaults to "just this day", with
  an explicit "every week" choice.

## Data

- `day_focus(profile_id, on_date, task_id, position 1 to 3)`: unique per
  day by task and by position.
- `week_plans(profile_id, week_start Monday, task_id, position 1 to 5)`:
  unique per week by task and by position. A week must start on Monday.
- `set_day_focus()` and `set_week_five()` replace a whole day or week in one
  transaction. They are security invoker, so RLS decides every row, and a
  pick can only point at a task the caller can already see.
- Access rules: staff manage only their own picks. Clients, parents,
  advisors and other staff read none.
- `day_focus` is separate from `pin_today`, which keeps its meaning and its
  "Pinned for today" section on Today.

## Screens

- **Today, My three:**
  - Up to three tasks for the local day, checked off through the task
    system.
  - Picking past the cap says "Today already has three. Take one off
    first." and changes nothing.
  - Finished picks keep their place.
  - The picker offers the week's five first, then pinned tasks, then tasks
    by due date.
- **`/week`, This Week's Five:**
  - **The five:** a numbered five, checked off through the task system.
  - **From last week:** last week's open five, with "Carry to this week"
    or "Let it go". Letting go only hides the item on that device; the
    task stays in Tasks.
  - **Also due this week:** the rest of the week's due tasks, overdue
    first in the caution color.
  - A link to the schedule.
- The HQ Week tab now opens `/week` (it opened the Schedule before).
- "Today" and "this week" are the viewer's local day and Monday, read after
  mount, matching Today and Schedule.

## Tests

- `supabase/tests/week_focus.test.sql`:
  - Sets replace in order.
  - A fourth or sixth pick is refused, with the existing picks untouched.
  - Duplicates are refused, and a week must start on Monday.
  - A coach cannot point at the owner's task, and an owner cannot point at
    another org's task.
  - Nobody else reads anyone's picks, and clients and advisors cannot write
    them.
  - Deleting a task removes its pick.
  - Mutation check: dropping the visible-task condition fails the suite.
- `src/lib/hq/week.test.ts`: the suggested five's order and the five cap,
  the "still open" filter, the order tasks are offered for picking, and the
  capped toggle.

## Not built yet

- Plan my week, Sort what matters (quadrants), Goals, and work-time math.
- Placing a five in a work block.
- Sharing the five with an advisor (the `five` share key exists but is not
  used yet).

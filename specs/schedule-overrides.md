# Schedule: one-day moves, real repeats, busy holds (Phase 4b, as built)

Part of Week (`specs/week.md`). This changes the live Schedule grid for
everyone who uses it (owner and coaches), on the classic layout and the
owner HQ layout alike. That is why it ships on its own.

## The problem it fixes

`schedule_blocks` is a template week. Before this change, dragging
Thursday's block rewrote the template, so every future Thursday moved
too. "Every other week", "Monthly" and "One time" were labels only: those
blocks still showed every week.

## Decisions (2026-10-22, the owner's go-ahead)

- A drag or resize on a repeating block moves **just this day** by
  default. The toast reads "Moved for Thu, Oct 22 only." and offers
  **Every week** and **Undo**.
- A one-time block just moves; there is nothing else to protect.
- Nothing ever moves on its own. A move or a new block that lands on
  another block says so ("This overlaps Family small group, 7:30 – 9:30
  AM.") and saves anyway. Travel never counts as a clash.

## Data (migration `20261023000001_schedule_overrides.sql`)

- `schedule_block_overrides(block_id, on_date, new_date, start_min,
  end_min)`:
  - One per block per date.
  - `on_date` must fall on the block's weekday, and the org must be the
    block's org. A trigger enforces both.
  - `new_date` stays in the same Monday-to-Sunday week.
  - The row cascades with its block.
- `schedule_blocks.anchor_week` (a Monday) sets when a non-weekly repeat
  starts counting:
  - Every other week: even weeks from the anchor.
  - Monthly: the same nth weekday as the anchor week, for example the
    third Tuesday.
  - One time: the anchor week only.
  - A null anchor keeps the old behavior (every week), so no saved block
    changes. Every production block was weekly when this shipped.
- `hold` block type ("Busy hold"), drawn hatched. It is also allowed as
  the default type in schedule settings.
- RLS has the same shape as `schedule_block_tasks`: an override rides its
  block's visibility. The owner reaches the org's blocks and a coach
  reaches their own. Clients, parents, advisors and other orgs reach
  nothing.

## Behavior

- `src/lib/schedule/occurrences.ts` places every block within a given
  week. The grid, the work-block rollover and Today all read it, so a
  one-day move shows the same everywhere.
- The grid now shows one dated week at a time:
  - Day headers carry dates.
  - The stepper goes one week back and any number of weeks ahead, with
    "Back to this week".
  - The now line and the rollover run only on this week.
- Dropping a moved block back on its template spot clears the override.
- When a block was moved for one day, the editor says "Moved for Thu,
  Oct 22 only" with **Put it back**. The editor's times still edit every
  week.
- **Every week** moves the template and drops that day's override. If
  the weekday changes, it also drops the block's overrides from that week
  on, because they belonged to the old weekday.
- Changing a block's repeat sets its anchor to the week on screen ("Counts
  from the week of Oct 19").
- Task links stay keyed by block and week, so a work block's tasks follow
  its one-day move.

## Tests

- `supabase/tests/schedule_overrides.test.sql`:
  - A one-day move leaves the template row alone, and next Thursday has
    no override.
  - A second move of the same date replaces the first.
  - Shape: no move into another week, the date must be on the block's
    weekday, the end must come after the start, Sunday counts as the same
    week, and an anchor must be a Monday.
  - Hold is accepted as a block type and as the default type.
  - Access: a coach cannot read or write the owner's overrides. Another
    org cannot see them or point at them. Client, parent and advisor read
    and write nothing.
  - Overrides cascade with their block.
  - Mutation check: dropping the block-visibility condition from the
    policy fails the suite.
- `src/lib/schedule/occurrences.test.ts`:
  - A one-off Thursday move leaves next Thursday unchanged.
  - Overrides for other blocks or dates do nothing.
  - Ordering, all four repeats, and the unanchored fallback.
  - Clash naming, which ignores travel, ignores the block itself, and
    lets touching edges pass.
- `src/lib/hq/today.test.ts`: Today follows one-day moves this week and
  not next week.

## Not built yet

- Booked `sessions` are not drawn on the grid or counted in the clash
  check. Today still lists them.
- Work-time math (work blocks minus holds) and placing the five in a
  work block.
- A one-day delete ("skip this Thursday").
- Phone agenda for the Schedule (Phase 5).

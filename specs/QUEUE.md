# Build queue

What is next, in order. Each item ships as its own reviewed PR. Its
migrations go to production before its code merges, and owner, coach,
client and parent screens outside the item stay unchanged.

The approved design references are in `specs/design/`:
- `README.md`: the overview, shared layout rules, and build order.
- `hq-advisor-handoff.md`: Gabe HQ, Business, and Remi.
- `customer-fitness-handoff.md`: the client app and Gabe's fitness tools.

The prototype HTML is not in the repo. It came in
`Wild Wanderers App.zip` (v2, with ClientApp and GabeFitness).

## Done

| Item | PR |
|---|---|
| Phase 0 and 1: owner HQ flag, shell, Business launchpad, Today | #21 |
| Profiles guard (security) | #21 |
| Phase 2: advisor role, access, Work, From your advisor | #22 |
| Phase 3: Calls, transcripts to reviewed actions | #23 |
| Week (4a): My three and This Week's Five | #24 |

## Now

2. **Week (4b): one-day schedule overrides.** See
   `specs/schedule-overrides.md`. Its migration goes to production before
   the PR merges.

## Next

3. **Customer fitness**, added 2026-10-22. Phases from
   `customer-fitness-handoff.md` §13, one PR each:
   1. Client Today and Progress: weekly content from the Library, plan
      visibility, Add an activity, history.
   2. Exercise Studio: new move fields, drafts, `builder_ok`, clips and
      loop points, the client preview.
   3. Build a workout: the deterministic engine, swap, save, coach
      restrictions.
   4. Guided player: loops, timers, cues, pause, resume, skip, extend,
      completion. Plan workouts move to the player.
   5. TV: mirroring docs first; a Cast receiver later.
4. **Operational polish (Phase 5)**, one module per PR: Tasks (List
   default), Schedule phone agenda, Clients and profile, Dads & Kids (nine
   tabs into three groups, old `?tab=` mapped), Leads, Numbers with
   targets, Pop-up polish.

## Repo findings for customer fitness (checked 2026-10-22)

These answer the handoff's "verify" items:

- **`activity_logs` already exists** (ring2: `client_id`, `logged_at`,
  `kind`, `duration_minutes`, `source`, `notes`, with client-own RLS).
  Extend it (for example with `external_id`) rather than creating another
  log table.
- **Homework is its own model:** `client_homework` (title, details, due
  date, status, completion note). The "a 20-minute walk counts toward walk
  homework" rule needs a decision on how a log links to a homework item.
- **`exercise_library.kind` is an enum:** strength, cardio, mobility,
  warmup, cooldown, skill. The handoff's `section` (warm / main / cool)
  could be derived from it, or added and backfilled from it.
- **Library posts already have an `audience`** (`public` or `members`).
  The handoff's audience and `publish_at` extend this. Workout of the week
  needs a "one live at a time" rule.
- The current movements manager is `ExerciseComposer.tsx` and
  `MovementsList.tsx`. Read both before designing Exercise Studio.
- Clips are labeled placeholders until Gabe uploads real footage. Never
  generate his likeness.

## Open decisions before customer fitness

- Client navigation: the design gives clients Today, Workouts, Progress,
  Me. That changes the client menu, which is otherwise locked unchanged,
  so it needs its own flag or an explicit yes.
- The homework and activity link rule above.
- Whether self-built workouts can be shared with Gabe automatically, or
  only on request. The design labels them "not reviewed by Gabe"
  everywhere.

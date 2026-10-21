# Advisor Calls: transcripts to reviewed actions (Phase 3, as built)

The advisor pastes a coaching-call transcript, reviews proposed items with
the words each came from, and sends only what they choose. Builds on
`specs/advisor.md`.

## Rules the owner confirmed (2026-10-21)

- **Retention:** transcripts are kept 90 days, then deleted.
  - An expired call is unreadable at once, because the access rules check
    `expires_at`.
  - `purge_expired_calls()` deletes expired calls. It runs whenever the
    Calls list loads, and daily through `pg_cron` where the extension
    exists.
- **Deletion:** only the advisor can delete a call. Tasks already sent stay.
- **The owner never sees a transcript or the proposals.** Neither table has
  an owner policy. The owner sees only the tasks the advisor sends, which
  carry the item text and date and nothing else.

## Data

- `coaching_sessions`: one call. Holds the transcript (up to 200,000
  characters), status, agenda, `expires_at`, and a `request_key` so a retry
  saves once.
- `session_items`: what was proposed from a call.
  - `section`: `owner`, `advisor`, `decided`, `note`.
  - `owner`: `owner`, `advisor`, `unclear`. Sections and owners use roles,
    never names.
  - Also stores the source `quote` and timestamp, a `flag`, a
    `match_task_id`, a review `state`, `send_as`, `keep_private`, and a
    stable `item_key`, so re-running extraction never doubles an item.
- `business_tasks.source_session_item_id` is unique, so each item makes at
  most one task.

## Flow

1. **Add a call.** Paste or load a `.txt`, add a title and date. Saving
   opens the review.
2. **Propose items.** The transcript goes through the AI chokepoint
   (`callCoachStructured`, which logs the call and checks the budget). The
   instructions:
   - quote exactly
   - set a due date only when a day was said
   - mark the owner unclear when unsure
   - skip anything personal or about anyone's health
   - use plain wording, with no em dashes

   Proposals are then compared with existing work:
   - a close match to open work is flagged "Already in the app" and linked
   - a close match to finished work is flagged "Possibly done"
   - masked client tasks never match
3. **Review**, in four groups: For (owner), For me, What we decided, Other
   notes.
   - Each item can be edited, given an owner and a date, sent as an
     assignment or a suggestion, kept private, accepted, or removed (and
     restored).
   - A wrong match can be unlinked.
   - Items can be added by hand. This is also the path when Scout is not
     set up or is over budget.
4. **Send.** "What (owner) will see" previews exactly what Send creates.
   `advisor_send_call()` runs in one locked transaction:
   - owner items become assignments or suggestions in the owner's tasks
   - advisor items and anything kept private become private to-dos
   - a match is linked, not duplicated
   - decisions and notes stay on the record
   - an item whose owner is unclear is held back

   A re-send or retry creates nothing new.
5. **Prep the next call.** An agenda is drafted from real work: what got
   finished since the last call, what is still open, undecided suggestions,
   questions, and what is owed. It is editable and saved with the last
   call.

## Tests

- `npm run test:rls`, `supabase/tests/advisor_calls.test.sql`:
  - The owner, coach, client, parent and an unrelated advisor read no calls
    or items.
  - Only the advisor can send or delete.
  - Send creates exactly the right work, and a re-send creates nothing.
  - Held, unreviewed, private and removed items never reach the owner.
  - Expiry hides a call, the purge deletes it, and sent tasks remain.
  - Removing access hides calls.
  - Mutation check: dropping the expiry condition fails the suite.
- `npm test`, `src/lib/advisor/calls.test.ts`: stable item keys, matching,
  the send preview mirroring the database item for item, and the agenda.

## Known limits

- The voice check on AI output covers the quotes too. A transcript quote
  containing an em dash or a flagged word triggers one retry, which may
  reword that quote.
- Transcripts are sent to the Anthropic API for extraction, under the same
  AI setup as check-ins. The ledger stores ids and token counts only.
- The agenda is private to the advisor. Sharing it with the owner is not
  built.
- Overview (the advisor's home summary) is not built. Work and Calls cover
  the flows.

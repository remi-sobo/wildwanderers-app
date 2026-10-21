# Advisor: role, access, and Work (Phase 2, as built)

A business advisor (Remi) works with the owner on the business. The approved
redesign gives the advisor Overview, Calls and Work. This phase builds the
permission foundation and Work. Overview and Calls come later.

## The boundary, in the database

- `user_role` gains `advisor`. On its own it grants nothing.
- **An advisor profile has no `org_id`.** `get_user_org()` is null for them,
  so every existing org-scoped policy fails closed: clients, wellness,
  check-ins, kids, families, forms, messages, finance, leads, pop-up, tasks,
  schedule. The test suite shows that giving an advisor an org would leak
  `organizations`, `food_items`, `program_badges` and `forms`, which is why
  they never get one.
- Access comes only from:
  - `advisor_relationships`: which org an advisor works with, managed by
    the owner. `advisor_org_ids()` returns the active ones.
  - `advisor_shares`: what the owner shares, managed by the owner. Only
    `tasks` is used today.
  - `advisor_items`: the advisor's own work. `private` rows have no owner
    policy. The owner reads `shared` rows only and can never edit them.
  - `advisor_tasks()`: a definer function returning a masked projection of
    the owner's tasks. It covers tasks the advisor assigned, and tasks the
    owner shared while the tasks share is on. It returns no link ids and
    no assignee. Anything linked to a client, lead, customer or the kids
    program reads "A client task · details not shared with you", with no
    description.
  - `advisor_assign_task()`: assign or suggest to the owner. It is
    retry-safe: the client request id becomes the task's `dedupe_key`.
  - `advisor_orgs()`: the org name and the owner's first name, for labels.
- `business_tasks` gains `kind` (`task`, `assignment`, `suggestion`),
  `assigned_by`, and `shared_with_advisor`.
- The advisor never selects `business_tasks` or any coaching table directly.
  No service-role shortcut is used for any advisor read.

## In the app

- **Routing:** no role falls through to another role's surface.
  `requireClient` admits only clients. Every guard sends other roles to
  their own surface. An unknown role lands on `/no-access`. An advisor lands
  on `/advisor` and sees a menu of Work and Settings only.
- **Owner, Settings:** an Advisor access card.
  - Invite by name and email. The login is created with the advisor role
    and no org. An email that already has an account is refused, and a
    failed invite removes the login it created. The advisor sets a
    password from Forgot password.
  - Remove or restore access.
  - The Tasks you share toggle.
- **Owner, /tasks:** From your advisor.
  - Suggestions offer Add to my tasks or Not now. A suggestion becomes a
    task only when accepted, and stays out of every list, Today and the
    Business counts until then.
  - Recent assignments, which are ordinary tasks.
  - Deliverables the advisor marked ready, and open questions. These are
    read only.
  - The task drawer gains Share with your advisor while an advisor is
    active and tasks are shared.
- **Advisor, /advisor (Work):**
  - One box adds work. The advisor picks where it goes: Me · private,
    I owe (owner), Assign to (owner), Suggest to (owner), or Ask (owner).
  - Three filters: Mine, (owner)'s with status, and Waiting on.
  - Every new item carries a request key, and a failed save keeps both the
    text and the key, so retrying never doubles it.

## Tests

`npm run test:rls`, in `supabase/tests/advisor.test.sql`:

- The advisor reads zero rows in every existing table, with seeded
  sensitive rows. Sealed tables refuse outright.
- The advisor cannot write to existing tables.
- `advisor_tasks()` returns only assigned or shared tasks, masks linked
  tasks, and shows nothing from other orgs.
- Assignments are retry-safe. The owner completing one shows the advisor
  one status change and no duplicate.
- Unrelated advisors, other orgs, the owner and coaches are refused by the
  functions.
- Private items never reach the owner. The owner cannot edit or delete
  advisor items.
- Coaches, clients, parents and other orgs read no advisor rows.
- Removing access ends everything.
- An advisor cannot grant themselves a relationship, a share or an org.
- A retried item makes one row.

Mutation checks: turning masking off, or giving an advisor an org, fails
the suite.

## Deploy order

The migrations go before the code. The code selects `business_tasks.kind`
and `shared_with_advisor`, which must exist first. The migrations are
additive and inert until an advisor is invited.

## Not built yet

- Overview and Calls (transcripts, review, prep): Phase 3.
- Owner acknowledgment of advisor items, and advisor comments on shared
  tasks.
- Shares for goals, the five, schedule and numbers (their screens do not
  exist yet).
- Switching between several owners for one advisor. The first active
  relationship leads.

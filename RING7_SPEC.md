# Ring 7 — The Boys Program Completions (Wild Wanderers Platform)

Ring 5 stood up the boys program as an operational back office: programs, cohorts,
the roster, sessions, attendance, badges, and a family read-only view. Ring 6 added
the earned experiences. This ring completes the program the way a real family
joins one: the family comes first, the forms get signed, a spot is offered and
accepted, and each boy's adventure is logged and visible to his family. Mentor
onboarding is the one piece held for its own ring, because Gabe flagged it as a
later phase and it is large enough to stand alone.

Source: the `WW_App_Assessment_Spec.md` boys-program completions (its final
section), reconciled against the built Ring 5 schema. This is the buildable ring,
forked onto what already exists.

## What already exists (Ring 5, do not rebuild)
- `programs`, `program_groups` (cohorts), `program_coaches`, `participants` (the
  kids, with denormalized `parent_name` / `parent_email` / `parent_phone` and a
  `parent_user_id` login link), `program_sessions`, `attendance`, `program_badges`
  and `participant_badges`.
- The family-facing parent view (Ring 5.4): a parent logs in and reads their own
  child's schedule, attendance, and badges, behind an invite-and-login flow, with
  the `parent` role and `current_user_participant_ids()` RLS helper.
- Ring 4's `offerings` (with `offering_kind = 'boys_program'`), `revenue_events`,
  and `leads` (with `lead_interest = 'boys_program'`). Tuition and scholarships
  ride these. We do not build a second billing system.

## The guardrails that lead
- **Minors' data, handled with care.** Emergency contacts, medical information,
  and signed forms are the most sensitive data in the app. Org-scoped and
  staff-only from the first migration, plus parent-own-child through the Ring 5
  helper. No client, no other family, no other org ever reaches it.
- **A waiver gates a session.** A liability waiver is the one thing a session
  cannot run without. Forms come first in the build order, and the roster surfaces
  who has and has not signed, so Gabe never runs a session on an unsigned kid.
- **Forms are versioned and acknowledged.** Every form stores its text and a
  version; an acknowledgement records who signed, which version, and when. A new
  version re-prompts for signature; an old signature is never silently carried
  forward.
- **Tuition reuses Ring 4.** An enrollment links to a `boys_program` offering and
  writes a `revenue_event`. A scholarship is a recorded discount on the
  enrollment, with a reason, never a second ledger.
- **No fabricated families.** Families, kids, forms, and enrollments are only ever
  what Gabe and the family enter. The surfaces open empty. We seed only the form
  catalog and the training-track outline, which are configuration, clearly named.
- **Warm, never gatekeeping.** Gabe dislikes "apply." A family requests a spot and
  is welcomed; a waitlist is "next in line," never a rejection. A family is never
  framed as failing (voice rule, load-bearing here too).

## The shape: family first, then the child
Ring 5 hangs parent contact off each kid. This ring inverts it to match how a
family actually joins: a guardian record comes first and owns one or more kids.

- **`guardians`** (new) — the family anchor: id, org_id, first_name, last_name,
  email, phone, `user_id` (the login link, moved here from `participants`),
  address, notes, created_at. The Ring 5 `participants.parent_*` fields stay for
  back-compat and are backfilled into a guardian on migration.
- **`participant_guardians`** (new) — the link, many-to-many so a kid can have two
  guardians: participant_id, guardian_id, relationship (`parent`/`guardian`/
  `emergency`), is_primary, can_pickup. This carries pickup authorization.
- **`participant_medical`** (new) — one row per kid, tightly scoped: participant_id,
  allergies, conditions, medications, notes, doctor_name, doctor_phone,
  insurance_note, updated_at. Nullable throughout; log what the family shares.
- **`emergency_contacts`** (new) — id, participant_id, name, relationship, phone,
  is_primary. At least one is part of a complete intake.

## The forms
- **`forms`** (new, catalog, org-scoped) — id, org_id, kind (`waiver`, `medical`,
  `photo_release`, `pickup`, `code_of_conduct`, `parent_agreement`), title, body
  (the current text), version, is_required, is_active, updated_at. Seeded with the
  six starter forms as clearly-labeled placeholders Gabe edits, never invented
  legal text presented as final.
- **`form_acknowledgements`** (new) — id, org_id, form_id, form_version,
  participant_id, guardian_id, acknowledged_by (the signing user), signed_name,
  acknowledged_at. Unique on (form_id, form_version, participant_id). A version
  bump on a form clears the "signed" state for that kid until re-signed.

## The enrollment path (warmer than "apply")
One record tracks a family from interest to enrolled, tied to Ring 4.
- **`enrollments`** (new) — id, org_id, program_id, participant_id, guardian_id,
  status (`interested`, `waitlisted`, `offered`, `enrolled`, `withdrawn`),
  offering_id (the Ring 4 `boys_program` offering that sets tuition), tuition_cents
  (snapshot at offer), scholarship_cents, scholarship_reason, notes, created_at,
  status_changed_at. When status moves to `enrolled`, a `revenue_event` is written
  through the Ring 4 path for the net tuition. A `leads` row with
  `lead_interest = 'boys_program'` can convert into an enrollment, so the business
  pipeline and the program stay one funnel.
- The word for the first step is a decision (below). The status enum stays neutral
  (`interested`) so the label can change without a migration.

## The student adventure log
Each boy's story, visible to his family read-only.
- **`adventure_entries`** (new) — id, org_id, participant_id, kind (`journal`,
  `check_in`, `mentor_note`), title, body, entry_date, author_id, visible_to_family
  (default true for journal and check-in, false for a private mentor note),
  created_at. Badges (Ring 5) and earned experiences (Ring 6) already exist; the
  adventure view pulls all three together.
- The Ring 5 family view extends to a fuller adventure tab: the schedule and
  attendance it already shows, plus badges, earned experiences, the nature
  journal, and check-ins, and any forms still needing a signature. Private mentor
  notes never cross to the family.

## Mentor onboarding (held for its own ring, Ring 8)
Gabe flagged this as a later phase and one of the most important. It is large:
mentor profile, certifications, background check status, first aid, availability,
and a training track (philosophy, safety, child development, emotional
intelligence, outdoor skills, leadership), plus the brotherhood layer (book club,
accountability, service, retreats) as simple records. Recommend splitting it into
Ring 8 so this ring stays reviewable. The tables it will add (`mentors`,
`mentor_certifications`, `mentor_availability`, `mentor_training`,
`brotherhood_activities`) are named here so the shape is visible, not built now.
A background check stores a status and date only; the check itself runs with a
provider we integrate later, never raw check data in our tables.

## Definition of done (this ring, mentor onboarding excluded)
- Gabe adds a family first, then adds a kid under that family, with emergency
  contacts, medical notes, and pickup authorization.
- Gabe manages the six forms and their versions; the roster shows each kid's
  signed and unsigned required forms, and a session cannot be run blind to a
  missing waiver.
- A family moves through the path: interested, waitlisted, offered, enrolled, with
  tuition set from a Ring 4 offering and an optional scholarship, writing one
  revenue event on enrollment. No second billing system.
- Each kid has an adventure log (journal, check-ins, mentor notes), and the family
  view shows the adventure and any forms to sign, own child only.
- Every new table is org-scoped, staff-only plus parent-own-child by RLS, verified
  on the live DB (a client sees none of it; a family sees only their own kid). No
  fabricated families. `npm run build` and the type check pass.

## Surfaces
- **`/boys/[id]`** gains: a family-first "Add a family" then "Add a kid" flow on the
  roster; a Forms tab (manage forms, see who has signed); an Enrollment tab (the
  path, tuition, scholarships); an Adventure tab per kid (journal, check-ins,
  notes). These extend the existing Ring 5 sub-shell.
- **The family view** (`/family`) extends: the adventure tab and a "forms to sign"
  prompt, own child only.
- A light intake surface a guardian can complete after invite (the forms to sign,
  the medical and emergency details), so the family does the data entry, not Gabe.

## Commit sequence
1. **Migration** — the guardians, participant links, medical, emergency contacts,
   forms and acknowledgements, enrollments, and adventure entries, with RLS
   (staff and parent-own-child), the seeded form catalog, and the Ring 5 parent
   backfill into guardians. Isolation verified in the DB.
2. **Family-first intake** — the guardian-then-kid flow, emergency contacts,
   medical, pickup authorization, on the roster.
3. **Forms** — the form catalog and versions, the sign flow, the roster's
   signed/unsigned state, the waiver gate on running a session.
4. **Enrollment** — the interested-to-enrolled path, tuition from a Ring 4
   offering, scholarships, the one revenue event, lead conversion.
5. **Adventure log + family view** — journal, check-ins, mentor notes, and the
   extended family adventure tab plus forms-to-sign.
6. **Final pass** — the warm copy, audit on the sensitive reads, reconcile the
   docs, confirm no fabricated families, merge.

Each commit: build green, one change at a time, RLS on every new table, no client
and no other family reaching a kid's data, no fabricated family, shown before it
lands.

## Decisions to lock before build
1. **The warmer word for "apply"** — options: "Request a spot," "Express
   interest," "Join the waitlist," or a coined phrase. The status enum stays
   neutral so this is a copy choice, not a migration. **Recommend "Request a
   spot."** Gabe's call.
2. **Mentor onboarding split** — build it as its own Ring 8 rather than in this
   ring, to keep this one tight. **Recommend yes, split it.**
3. **The family model** — introduce a `guardians` entity that owns kids and holds
   the login, backfilling the Ring 5 `participants.parent_*` fields. **Recommend
   yes**; the alternative (keep parent data on the kid) does not support two
   guardians or a family with several kids.
4. **Tuition and scholarships** — model as an enrollment linked to a Ring 4
   `boys_program` offering plus a revenue event, scholarship as a recorded
   discount. **Recommend confirming**; no second billing system.
5. **Background check (Ring 8)** — store status and date only, integrate a provider
   later, never raw check data. Confirm.
6. **Carried-over Gabe decisions** — faith and the Kyezen spelling, if a philosophy
   or mentor-training surface shows them, take the same answers as the site spec.
   Not re-litigated here.

## Build status
Spec only. Not yet built. Awaiting the decisions above, chiefly the warmer word
and the mentor-onboarding split, then the migration lands first as commit 1. Per
the craft-pass loop, the family intake and the adventure view get a just-in-time
design pass against the best youth-program and family-onboarding tools before
their UI lands.

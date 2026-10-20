# Spec: Pop-up roll call (attendance, bring-a-friend, waivers, walk-ups)

Status: **approved 2026-10-19, built.** Decisions resolved at the bottom.
The uploaded waiver changed the model in three places, noted under
"What the waiver changed".

## Problem statement

On a Saturday pop-up morning Gabe is standing in a park with a phone. He
needs to:

1. See who signed up (the pop-up list) and tap each person who came.
2. Add anyone who walks up on the spot and was never on the list.
3. Record who brought whom, so he knows who earned the published offer:
   "$25 per session. Bring two friends and yours is free."
   (`wildwanderers/src/content/fitness.ts`, Saturday page.)
4. Know, before anyone works out, who has signed the waiver.

Today the app can show the list (`/business/popup`, PR 19) but cannot record
a pop-up day, attendance, referrals, or an adult waiver.

## What exists today (verified in code)

- **`library_subscribers`**: `id, org_id, email (not null), created_at,
  source` (`'saturday'` from the pop-up form, `'trailhead'` from the library
  signup). Unique per `(org_id, lower(email))`. RLS: anon insert-only,
  `owner_manages_subscribers` is `for all` for the owner, so the owner can
  already insert. **No name or phone column**: the pop-up form collects both
  and drops them (`wildwanderers/docs/v2-handoff-2026-10.md`).
- **Boys program attendance** (`program_sessions`, `attendance`, Ring 5) and
  **forms + `form_acknowledgements`** (Ring 7). Both are bound to
  `participants`, which are kids with guardians. Not reusable as-is for adult
  pop-up guests, and mixing adult guests into the minors' tables would widen
  access to the most sensitive data in the app. We reuse their *shape*, not
  the tables.
- **`forms`** is the versioned catalog, unique per `(org_id, kind)`. The
  `'waiver'` kind is already the boys waiver. The pop-up waiver is a different
  document for adults, so it gets its own kind.
- **`sessions`** (Ring 1) is coach-and-client sessions tied to a client or a
  group. Pop-up guests are not clients, so a pop-up day is its own record.

## Scope

**In:**
- A pop-up day record (date, time, location).
- Roll call on the day: tap present, add a walk-up, mark "came with", mark
  waiver signed.
- Bring-a-friend eligibility, derived, not typed in.
- Name and phone kept on `library_subscribers` (both optional).
- The pop-up waiver in the `forms` catalog, versioned, signed on paper or on
  the guest's own phone through a QR.

**Out (v1):**
- Payments and Stripe. Gabe takes payment however he does today; the app only
  tells him who is free.
- RSVP tracking from the pre-Saturday email.
- Offline mode. See failure modes.
- Converting a guest to a client or lead. One tap later, not now.

## What the waiver changed

Gabe's waiver (Participation Agreement and Release of Liability, Saturday
Pop-Up Workouts) says:
- **Valid for all 2026 pop-up sessions.** A signature belongs to the person
  for the season, not to one visit, so waivers are their own table.
- **Ages 10 and up; under 18 signed by a parent or guardian**, who must be
  present. A parent's email can carry several kids, so a person who comes is
  a `popup_guests` row keyed by email and name, not a `library_subscribers`
  row (one per email).
- **Emergency contact and a photo yes or no** are part of the form.

## Data model (as built)

Migrations `20261019000001_popup_waiver_kind.sql` (the enum value) and
`20261019000002_popup_roll_call.sql` (everything else).

- `library_subscribers` gains `name`, `phone`, `added_by`. It stays the email
  list: a walk-up or a self-signer joins it only on a yes. anon's insert is
  narrowed to `(org_id, email, source, name, phone)`.
- `forms` gains `valid_through date`. Seeded: kind `popup_waiver`, Gabe's text
  verbatim, version 1, valid through 2026-12-31 (Wild Wanderers org only).
- `popup_days`: `starts_at, ends_at, location, notes, sign_token` (the QR
  link). Seeded with the four published Saturdays, 8:00 to 9:30am Pacific.
  Location left empty for Gabe.
- `popup_guests`: `full_name, email (required), phone, age_if_minor (10 to
  17), subscriber_id` (an adult's own list row, never a kid's).
- `popup_waivers`: guest, form and version, `signed_via` (`self` or
  `paper`), signed name, guardian name and relationship, emergency contact,
  `photo_ok`, IP and user agent for a self signature. Unique per guest per
  version: a new version re-prompts.
- `popup_attendance`: day, guest, `brought_by` (another guest),
  `free_session`. Unique per guest per day.
- Bring-a-friend: friends = present rows that day with `brought_by` = this
  guest. Two or more shows "session free"; Gabe taps to confirm the comp.

## RLS (as built, verified on a local replay of every migration)

- All four `popup_*` tables: owner-only `for all`, org-scoped. anon has no
  table grants. A coach, a client, and another org's owner read zero rows.
- A same-org trigger on guests, waivers, and attendance refuses any
  reference across orgs (verified: a forged insert raises 42501).
- Public signing is two SECURITY DEFINER functions: `popup_waiver_for_token`
  (returns only the waiver text and the day's start, never the location) and
  `sign_popup_waiver` (validates every field, refuses under 10, requires a
  guardian for 10 to 17, marks the guest here when the day is open). Roster
  views write `popup.roll.view` to `audit_events`.

## Surfaces (as built)

- `/business/popup`: tabs Pop-up list, Library list, Pop-up days. Lists show
  the name beside the email. Pop-up days shows the next one with a big Take
  roll button, the season, and an add-a-day form.
- `/business/popup/[day]`: roll call. Counts (here, on the list, waivers on
  file), the waiver QR sheet, Add someone (top and bottom), search, Here and
  Not here yet sections. One 56px Here toggle per row; tap a row for came
  with, the free session, the waiver on file (emergency contact with a tap to
  call), or "They signed the paper copy".
- `/popup/sign/[token]`: public, no account. The waiver text, the form's
  fields, a typed-name signature, an unticked opt-in for the pop-up email.
  The link works until 12 hours after the day ends; signing within two hours
  of the session also checks the guest in.

## Build order (one commit each)

1. Migration: `library_subscribers` columns, `popup_days`,
   `popup_attendance`, `popup_waiver` form kind and placeholder seed, RLS,
   cross-org trigger. Verify live with simulated roles: client and anon read
   zero rows, coach reads zero, owner of another org reads zero.
2. Marketing site (`wildwanderers` repo): the pop-up form stores name and
   phone instead of dropping them.
3. Pop-up days tab: list and create.
4. Roll call screen: here toggle, search, counts.
5. Add someone (walk-up).
6. Came with and bring-a-friend counts, Free today.
7. Waiver sheet and chip.

## Definition of done

On a phone, Gabe opens Saturday's day, taps the people who came, adds a
walk-up in under 20 seconds, marks who came with whom, sees who has earned a
free session, and sees who still needs a waiver. Build and types pass, RLS
verified live, no client or other org reaches a row, no waiver text or
attendance number is invented.

## Failure modes

- **Spotty signal in the park.** Each tap is a server action; a failed save
  shows a clear retry on the row, never a silent loss. Offline queueing is
  v2 if the first Saturday shows it is needed.
- **Duplicate walk-ups** (same person, typo'd email). The add form searches
  as Gabe types and offers "Is this them?" before creating.
- **Someone brings friends but the friends are unmarked.** The count only
  sees friends with "came with" set, so the sheet reminds Gabe to set it when
  adding a walk-up.
- **Waiver version changes mid-season.** A new version shows "Needs waiver"
  again for everyone; old signatures are never carried forward (Ring 7 rule).

## Decisions (resolved 2026-10-19)

1. Email is required for every walk-up and signer.
2. The free session is the same day.
3. Anyone who came with them that day counts as a friend.
4. The waiver is on paper at the table and in the app. Text is Gabe's.
5. Guests sign on their own phone through the QR. Built in v1.
6. A walk-up joins the email list only when they said yes.
7. Sarah gets an owner login in the same org; the screen stays owner-only.

## Flags

- The waiver title carries an em dash, against the voice rule. It is Gabe's
  signed legal document, so it is stored exactly as the paper copy reads.
- The app does not claim the waiver has been reviewed by an attorney.
- Deploy order: apply the migration before the marketing site's pop-up form
  starts writing name and phone, or that form's inserts fail.

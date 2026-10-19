# Spec: Pop-up roll call (attendance, bring-a-friend, waivers, walk-ups)

Status: **draft, not approved.** No code until Gabe and Remi sign off on the
open decisions at the bottom.

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
- An adult pop-up waiver in the `forms` catalog, versioned.

**Out (v1):**
- Payments and Stripe. Gabe takes payment however he does today; the app only
  tells him who is free.
- Guests signing the waiver on their own phone (QR to a signing page). Good
  v2, see decisions.
- RSVP tracking from the pre-Saturday email.
- Offline mode. See failure modes.
- Converting a guest to a client or lead. One tap later, not now.

## Data model

All new tables carry `org_id`, RLS on from the migration that creates them.

### `library_subscribers` (alter)
- `name text` (nullable). The pop-up form starts saving it.
- `phone text` (nullable). Same.
- `added_by uuid references profiles(id)` (nullable). Set when Gabe adds a
  walk-up by hand, so the list can tell a self-signup from a manual add.
- `email_opt_in boolean not null default true`. False for a walk-up who came
  but did not say yes to the email list; sends skip them (decision 6).
- `email` stays `not null`. See decision 1 for guests with no email.

### `popup_days` (new)
`id, org_id, starts_at timestamptz, ends_at timestamptz, location text,
notes text, created_by, created_at`. One row per Saturday. Gabe creates them
(or we seed the four published dates: Oct 24, Nov 7, Nov 21, Dec 5, 8:00 to
9:30am, from the live site copy, not invented). Location stays private here
the same as on the site: owner-only.

### `popup_attendance` (new)
One row per person per day.
- `popup_day_id`, `subscriber_id` (references `library_subscribers`),
  unique `(popup_day_id, subscriber_id)`.
- `arrived_at timestamptz` (present when set; untapping clears the row).
- `brought_by uuid references library_subscribers(id)` (nullable): "came with
  so-and-so." A friend points at the person who brought them.
- `waiver_form_id`, `waiver_version int`, `waiver_signed_at timestamptz`,
  `waiver_signed_name text`: the acknowledgement, in the
  `form_acknowledgements` shape (who, which version, when). Lives on the
  attendance row in v1 because the guest has no `participants` record.
- `free_session boolean not null default false`: Gabe confirms the comp.
- `marked_by`, `created_at`, `updated_at`.

### `forms` (seed)
Add `form_kind` value `'popup_waiver'` and seed one row: title
"Pop-up waiver", body a **labeled placeholder** ("Gabe's waiver text goes
here, not yet provided"), version 1, required. No waiver language is written
by us.

### Derived: bring-a-friend
Eligible on a day = count of present rows that day with
`brought_by = this person` is 2 or more. Computed in the query, never stored.
The roster shows the count ("brought 1", "brought 2, free"). Gabe taps
"Free today" to set `free_session`, so the derived number suggests and he
decides.

## RLS

- `popup_days`, `popup_attendance`: owner-only, `for all`, `org_id =
  get_user_org() and get_user_role() = 'owner'`, the
  `owner_manages_subscribers` shape. Coaches get nothing until Gabe asks.
  Anon and clients reach zero rows.
- `brought_by` must point at a subscriber in the same org: a check in the
  write path (server action) and a trigger, so a forged id cannot cross orgs.
- `library_subscribers`: no policy change. The owner already has `for all`.
  Anon's insert grant stays column-limited by the policy; the marketing form
  gains `name` and `phone` in its insert.
- Waiver fields are personal data. Audit access via `audit_events` on roster
  reads, the same as body data.

## Surfaces

### `/business/popup` (existing, grows)
Three tabs: **Pop-up list**, **Library list** (both as shipped), and
**Pop-up days**. Days lists upcoming and past Saturdays with "12 came, 3 free"
for the past ones. Name shows beside email in both lists once collected.

### `/business/popup/[day]` (new): roll call, phone-first
- Header: date, "8 here of 23 on the list", waiver count "6 of 8 signed".
- Search box at the top (type a few letters of a name or email).
- One row per person on the pop-up list, alphabetical by name, then email.
  Each row, 44px targets:
  - **Here** toggle (big, left).
  - **Waiver** chip: "Waiver signed" (fern) or "Needs waiver" (amber). Tap
    opens a sheet: show the waiver text and version, type the signed name,
    confirm. Copy on the chip never frames the person; it is the paperwork.
  - **Came with** chip: pick who brought them from people marked here.
  - **Friends** badge, read-only: "Brought 2, session free" with a
    "Free today" tap.
- Present people float to the top.
- **Add someone** button (amber, the one action color), sticky at the bottom:
  name, email, phone (optional), "They said yes to the email list" checkbox,
  "Came with" picker. Saves a `library_subscribers` row (`source
  'saturday'`, `added_by` Gabe) and marks them here in one step. If the
  email is already on the list, it reuses that row and marks them here,
  keeping their original source.

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

## Open decisions (need Gabe)

1. **Walk-up with no email.** `email` is required today. Options: (a) require
   an email at the table (it is a mailing list, and it is how the next
   Saturday's spot is shared); (b) allow name-only guests, which means making
   `email` nullable. **Recommend (a).**
2. **Is the free session that same day, or the next one?** The site says
   "Bring two friends and yours is free," which reads as same day. Confirm.
3. **Does a friend count if they were already on the list?** Or only new
   people? Recommend: anyone who came with them that day.
4. **The waiver itself.** Paper or in the app? If in the app, Gabe needs to
   supply the waiver text; we do not write it. Has he had it reviewed, and
   does the insurance for the pop-ups require a particular form? The app
   will not imply a waiver has been legally reviewed.
5. **Guests sign on their own phone (QR at the table)?** Faster on a busy
   morning and gives a real signature, but it means a public signing page
   with anon writes. v2 unless he wants it now.
6. **Adding a walk-up to the email list.** Recommend only with the "said yes"
   box ticked; without it, they are recorded for the day but not sent the
   weekly note.

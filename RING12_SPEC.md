# Ring 12 — Coach accountability: the coach shares his own week

Gabe's ask, in his words: "Not only are they showing me their workouts, but then
they see mine and how my week is going. The idea that the coach is also growing.
I have my tough days. I need to lead by example. I am not the hero. I am
alongside these boys and other men in fellowship." Today the sharing runs one
way: clients log workouts, check-ins, habits, and Gabe coaches off them. Nothing
lets Gabe share his own week back. This ring closes the loop, so the relationship
is mutual and Gabe leads by showing, not telling.

This is a coach-to-client build. No client health data moves; the load-bearing
guardrails here are voice and tenancy, not the health rules.

## What already exists (do not rebuild)
- Clients share to Gabe: training completions, `check_ins` (voice or text,
  structured by Scout), habit logs, measurements, the wellness ring.
- Gabe (role `owner`) is a staff profile, not a client. He has no plan, no log
  surface, no place to record or share his own training. That gap is this ring.
- The content patterns we fork: the Trailhead composer and its actions
  (`PostComposer`, `src/lib/library/actions.ts`), the `library-covers` public
  bucket and its server-side `uploadCover` chokepoint, the draft/publish flow,
  the audit ledger, and the coach-writes / client-reads split of surfaces
  (`/library` composes, `/trailhead` reads).

## The guardrails that lead
- **Voice (load-bearing here).** These are Gabe's own words to his people. No em
  dashes, none of the AI-giveaway words, warm and direct. Scout may help him
  shape a note, but the voice stays his, and a share is never auto-published.
- **Never frame a client as broken.** A "tough day" share is about the coach's
  own journey, modeling that everyone is still learning. It never turns into a
  read on a client. The one rule that is not optional in a wellness app holds
  here too.
- **No medical claims.** Gabe sharing what he trained or how he felt is personal
  and motivational, never advice or diagnosis to clients.
- **No fabricated content.** We never write Gabe's voice for him. The only seed
  is one clearly-labeled sample share he replaces or deletes, the same honesty
  as the Trailhead sample post and the Ring 7 form placeholders.
- **Tenancy.** Shares scope to `org_id`. A client sees only their org's coach; no
  client or family ever sees another org. Multi-coach ready: a share is
  attributed to its author, and for now (one org, Gabe as owner) every client and
  family in the org sees it.

## The shape
A coach share is a short, honest note from Gabe to his people, optionally with a
photo and a line about what he moved this week. It carries a light tone tag so a
win reads like a win and a hard week reads as human, not as a lecture. Clients
and families see it, and can send back a small, wordless "walking with you" so
Gabe feels who is alongside him. That acknowledgement is the accountability made
mutual: his people see whether he shows up, and he sees who is with him.

Deliberately NOT in this ring, to keep it reviewable:
- A full mirror of the plan engine for Gabe's own sets and reps. He is not being
  coached; the need is honest modeling, not a second training app. A share can
  say what he moved in a sentence; it does not need a workout builder.
- The client-autonomy arc ("help people coach themselves, need less direction").
  It is the principle guiding this ring, and its own future ring (self-directed
  logging, client-led check-ins), not a surface we build here.

## The data model (new)
- `coach_shares`: `id, org_id, author_id (profiles), tone (enum), title (opt),
  body (required), training_note (opt, "what I moved"), media_url (opt photo),
  audience (enum: clients | everyone), status (draft | published), published_at,
  created_at, updated_at`.
  - `tone` enum: `note` (default), `training`, `lesson`, `win`, `tough_day`.
  - `audience` enum: `everyone` (clients and families, default) | `clients`.
- `coach_share_acks`: `id, org_id, share_id (fk, cascade), profile_id, created_at`,
  unique `(share_id, profile_id)`. One wordless acknowledgement per person per
  share. Its count is the true "who is walking with me" number, denormalized onto
  `coach_shares.ack_count` by a `SECURITY DEFINER` trigger, exactly the
  `post_challenge_completions` / `completion_count` pattern, so a client can read
  the count without reading anyone's identity.
- `coach-media`: a public Storage bucket for share photos, same reasoning and
  same server-side upload chokepoint as `library-covers` (a picture of Gabe on a
  trail carries no client data).

### RLS
- `coach_shares`: staff (owner+coach) manage their org's shares and see drafts;
  clients and parents read only `published` shares in their org, filtered by
  `audience` (a client never sees a families-only note, a family sees `everyone`).
- `coach_share_acks`: a client or parent writes and reads only their own ack in
  their org; the author (staff) reads all acks on the org's shares for the count.
- Ported from the Ring 0 helpers `get_user_org()`, `get_user_role()`,
  `current_user_client_id()`, strict from the first migration.

## Surfaces
Proposed name for the feature: **Alongside** (Gabe's word). Confirm before build.
- **Coach (owner+coach), compose and manage — `/alongside`.** A composer
  mirroring the Trailhead one: a note, a tone, an optional photo, an optional
  "what I moved," draft or publish. A list of past shares with their ack counts,
  edit, and unpublish/delete. Optionally a small cadence line ("shared 6 weeks
  running") so Gabe can see his own consistency, which is what keeps him
  accountable.
- **Client and family, read — Home card plus a reader.** A "From your coach" card
  on the client Home (and the family view) showing the latest share, with the
  "walking with you" acknowledgement. A fuller reader lists the recent ones. The
  card sits near where the client already shares to Gabe, so the loop reads as
  mutual.

Sidebar: add "Alongside" to the coach shell (owner+coach) and to the client and
parent menus, near the existing content entries.

## Commit sequence (one change each, green build, RLS from the first)
1. Schema: `coach_shares` + `coach_share_acks` + enums + the ack-count trigger +
   RLS + the `coach-media` bucket. Seed one labeled sample share. Apply and
   verify on the live DB.
2. Data layer and actions: read helpers (staff manage view, client/family feed,
   Home latest), write actions (create/update/publish/unpublish/delete with the
   photo chokepoint), and the client ack toggle. Guards and audit on every write.
3. Coach surface: the `/alongside` composer and manage list, sidebar entry.
4. Client and family surface: the Home "From your coach" card, the reader, the
   acknowledgement, sidebar entries.
5. Final pass: extend the demo client so the sample loop is visible end to end,
   reconcile `CURRENT.md`, and verify isolation on the live DB (a client sees the
   coach's published shares, a families-only note stays off the client feed,
   cross-org sees nothing, acks are per-person).

## Decisions to lock before build
1. **Name.** "Alongside" for the feature and the route, or another (Coach's log,
   From the trail, Walking beside). Recommendation: Alongside.
2. **Audience default.** Publish to clients and families by default, with a
   clients-only option. Recommendation: everyone by default; the boys' families
   are Gabe's people too.
3. **The acknowledgement.** Include the wordless "walking with you" ack (and its
   count) in this ring, or defer it. Recommendation: include it; it is what makes
   the accountability mutual and visible.
4. **Coach cadence line.** Show Gabe his own sharing streak. Recommendation:
   include a light version; it is the self-accountability he asked for.
5. **Scout assist.** Offer a "help me shape this" draft in the composer, like the
   Trailhead blurb. Recommendation: yes, off by default, his voice always final.

## Definition of done
It builds and types pass. Gabe can write, photo, draft, publish, edit, and delete
his own weekly share; clients and families see it and can send a wordless ack;
the count is true and never leaks identity. No client health data moves. No org
or client reaches another's. No medical claim and no fabricated coach voice
shipped. Each phase is a small, reversible commit, RLS present from the first.

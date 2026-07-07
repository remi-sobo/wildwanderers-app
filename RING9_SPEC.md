# Ring 9 — the Movements manager and real video

Gabe asked for two things: to change around the movements in the Fitness app
himself, and to add video. The exercise library already exists as a table the
plan builder reads from, seeded with common movements, but Gabe has no screen to
edit it, and the one video field is rendered as a plain link-out, not a player.
This ring closes both gaps. It is a coach-facing build, no client health data,
so the guardrails it leans on are tenancy and honesty, not the health rules.

## Source of truth check
- Master spec: `knowledge_base_items` retargets to "the exercise and wellness
  library ... watch/read/do content." Video is in scope by design.
- `CLAUDE.md`: no fabricated content (so no fake demo URLs on seeds), one change
  per commit, RLS covers any new surface, build stays green.
- We reuse, not reinvent: the Trailhead composer (`PostComposer` +
  `src/lib/library/actions.ts`), the `library-covers` storage pattern, the
  assessment catalog editor route (`/fitness/assessments`), and the existing
  `exercise_library` table and its staff-manage RLS.

## What exists today (verified)
- `exercise_library` (Ring 1.5): `title, kind, muscle_group, equipment,
  media_url ("demo video or gif"), instructions, cues, default_sets,
  default_reps, is_active`, unique per `(org_id, title)`. RLS: owner+coach
  manage, clients read active. Seeded with ~28 standard movements, all with
  `media_url` null.
- `src/lib/data/exercises.ts`: `getExerciseLibrary()` returns active items for
  the plan builder picker only. No write path anywhere in the UI.
- `PlanBuilder`: picks a library item, copies its `media_url` onto the workout
  exercise. `ClientTraining`: renders `media_url` as a "watch demo" icon that
  links out in a new tab. No embedded player, no upload.

## Decisions locked for this ring
1. **Surface name and place.** Call it **Movements**, at `/fitness/movements`
   (list), `/fitness/movements/new`, `/fitness/movements/[id]/edit` — a sibling
   of `/fitness/assessments`, since both are the coaching catalogs behind the
   Fitness surface. Reachable from a header button on Fitness and a "Manage
   movements" link in the plan builder. Owner and coach both manage it (matches
   the existing RLS); the (coach) layout already guards the route.
2. **Video is a URL, rendered as a real player.** `media_url` stays the single
   home of the demo. A shared `VideoEmbed` reads it and renders the right thing:
   a YouTube or Vimeo link becomes a responsive inline iframe; a direct file
   (`.mp4`/`.webm`, including our uploaded clips) becomes a `<video controls>`;
   anything else stays a safe link-out. This is the "real video" payoff and it
   lands for clients on the Training surface.
3. **Uploads come after links, as their own phase.** External links (YouTube,
   Vimeo, a file URL) cover Gabe's common case and ship first. Uploading a clip
   we host is added after, via a signed upload URL minted server-side so the
   file goes straight to Storage and never through a server action body limit.
4. **A public `exercise-media` bucket**, same reasoning as `library-covers`:
   generic movement demos carry no personal or health data. Read is public;
   writes are staff-minted.
5. **Ordering.** Add `sort_order` so Gabe can arrange his movements; list and
   picker order by `(sort_order, title)`. A small quality-of-life piece he
   implied by "change around the types of movements."
6. **No fabricated video.** The 28 seeded movements keep `media_url` null. Gabe
   attaches his own. We never paste a guessed demo URL onto a movement.

## Phases (one commit each, green build throughout)

- **Phase 1 — schema.** Migration: add `sort_order int not null default 0` and a
  `media_kind` marker is NOT needed (we parse the URL); create the public
  `exercise-media` storage bucket; backfill `sort_order` off the seed order.
  No RLS change (the table's staff-manage/client-read policies already cover the
  new column). Apply and verify on the live DB.
- **Phase 2 — data + actions.** `src/lib/data/exercises.ts`: add
  `getManagedMovements()` (all items incl. inactive, full fields, ordered) and a
  single-movement read. `src/lib/exercises/actions.ts`: `createMovement`,
  `updateMovement`, `setMovementActive` (retire/restore), `deleteMovement`
  (blocked when a plan references it, retire instead), `reorderMovements`. Each
  re-checks the caller with `requireOwnerOrCoach`, writes through RLS, and
  appends to the audit ledger. Link-based media only in this phase.
- **Phase 3 — the manager UI.** `/fitness/movements` list (active and retired,
  reorder, quick retire/restore) and an `ExerciseComposer` (create/edit)
  mirroring `PostComposer`: title, kind, muscle group, equipment, default sets
  and reps, cues, instructions, and a video field that takes a link and shows a
  live preview. Entry points: a "Movements" button on the Fitness header and a
  "Manage movements" link in the plan builder.
- **Phase 4 — real video everywhere.** The shared `VideoEmbed`. Swap the
  client Training link-out for an inline player, add a preview in the plan
  builder picker, and show the player in the movements list and composer. This
  is where "add video" becomes real for the client.
- **Phase 5 — uploaded clips.** A staff-minted signed upload URL to
  `exercise-media`, a size and type guard, and the composer's "upload a clip"
  path storing the public URL back into `media_url`. `VideoEmbed` already plays
  it (a hosted `.mp4`/`.webm`).
- **Phase 6 — final pass.** Extend the demo/seed only where honest (no fake
  URLs), reconcile `CURRENT.md` (and fix the stale Ring 8 = mentor-onboarding
  note), and verify the whole path on the live DB: a coach adds a movement with
  a video, it appears in the plan picker, the client sees it play on Training,
  and cross-org isolation holds.

## Definition of done
Builds and types pass. Owner and coach can add, edit, order, retire, and (when
unused) delete movements, with video by link and by upload. Clients see the
video play, not a bare link. No org reaches another's library. No fabricated
demo content shipped. Each phase is a small, reversible commit.

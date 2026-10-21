# Customer Fitness Experience: implementation handoff

**Where it lives.** This is part of the canonical prototype `Wild Wanderers - Production Redesign v2.dc.html`. Two modes were added: **Client phone** and **Client web**. The Gabe-side screens are in his existing Business area.

**Files**
- `ClientApp.dc.html`: client app plus the guided player and the simulated TV.
- `GabeFitness.dc.html`: Exercise Studio and Publish.
- `GabeOps.dc.html`: the client profile activity card.
- `ww-shared.js`: the `fit` example data.

**Prototype only:**
- the mode bar
- the "example state" chips (regular, new client, back after 5 days)
- player speed (normal, 4×, 10×)
- the "drop the connection" button
- the TV panel
- the simulated clip upload

There are no real clips, casting, or backend. All people are examples.

**Sources read** (`remi-sobo/wildwanderers-app@main`, Oct 21 2026)
- `src/lib/data/exercises.ts`
- field names in `templates.ts`, `plans.ts`, `library.ts`, `wellness.ts`

**Not read this round:** `ExerciseComposer.tsx`, `MovementsList.tsx`, `PlanBuilder.tsx`, `TemplateStartPicker.tsx`, `CoachDock.tsx`, `VideoEmbed.tsx`, and the client routes. Check their exact behavior before building. Assumptions below are marked **(verify)**.

---

## 1. Navigation

**Client.** Four destinations: **Today · Workouts · Progress · Me**.
- Phone: bottom bar.
- Web and tablet: top bar.
- Same screens on every device. Grids open to two or three columns as the screen widens.

**Gabe.** No new top-level destinations:
- Business → **Exercise Studio** is new in the directory. It is the current Movements manager, upgraded.
- Business → **Trailhead Library** is now the one composer for posts, wellness tips, and workout of the week.
- Business → Fitness links to both.
- Business → Clients → profile gets a **Training on her own** card.

## 2. Screen inventory

| Screen | Purpose | Phone | Web / tablet |
|---|---|---|---|
| Today | Gabe's weekly content, today's plan workout, build entry, this week's movement | One column | Two columns |
| Today, new client | No plan yet; build a short one; empty movement | Same | Same |
| Today, back after days | "It's been five days," start Day B or ease in | Same | Same |
| Workouts | Next action first: plan today, or Build. Then My plan, From Gabe, Saved and recent | Stacked | Three columns |
| Build a workout | One screen: time, focus, gear, difficulty (remembered), "anything bothering you", Gabe's restriction shown | Stacked | Choices left, restriction and Make right |
| Workout review | Sequence, timing math, swap, make another, save, start | Stacked | List left, sticky summary right |
| Swap sheet | Up to three replacements with the same pattern and filters | Bottom sheet | Right drawer |
| Guided player | Clip loop, big countdown, work / rest / get ready, cue, up next, progress, controls | Full screen, portrait or landscape | Video left, info right, browser full screen |
| TV remote, lost connection | Phone as remote; recover locally | In the player | In the player |
| Finish | Time, moves done x of y, effort, note, save, repeat, save workout | Stacked | Stacked |
| Progress | This week, four-week minutes, what you do most, history with Repeat, Add an activity | One column | Two columns |
| Me | Messages, plan and homework, check-in, avoid list, Library, Alongside, workout settings, account | Groups | Two columns |
| Exercise Studio | Search, Active / Drafts / Archived, movement filters, clip state, Build status | List | List |
| Move editor | Basics; how to (more on tap); clip; client preview; Use in Build; save, archive | Stacked | Two columns |
| Publish | Type, workout picker, title, words, video, audience, when, preview, live and earlier | Stacked | Composer left, preview and list right |
| Client profile, Training on her own | Plan status, her own workouts, logged activity, a follow-up summary | In the profile | In the profile |

## 3. Preservation map (client side)

| Today's client feature | After | Status |
|---|---|---|
| Home | Today | Enhanced |
| Training (plan, workouts) | Workouts → My plan. Plan workouts play in the guided player. Moves are locked ("Gabe set these") | Enhanced. The plan is never changed by the builder |
| Homework | Today plan card line, plus Me → Your plan and homework. A 20-minute or longer walk counts toward walk homework | Consolidated (verify the homework model) |
| Log | Progress → Add an activity. Guided workouts log on Save | Enhanced |
| Progress | Progress | Enhanced |
| Wellness check-ins | Me → Sunday check-in | Unchanged, moved entry point |
| Alongside | Me → Alongside | Unchanged |
| Trailhead Library | Today "Also from Gabe" and Me → Trailhead Library | Unchanged reading flow; the publishing side is unified |
| Messages | Me → Messages with Gabe, plus "Message Gabe" in Build, Finish and End | Unchanged workflow, more entry points |
| Account and settings | Me → Account, plus new Workout settings | Unchanged, plus new prefs |

## 4. Exercise data

**Existing** `exercise_library` fields, from `exercises.ts`:
- `title`, `kind`, `muscle_group`, `equipment` (text), `media_url`
- `default_sets`, `default_reps`, `cues`, `instructions`
- `is_active`, `sort_order`

`workout_exercises.library_item_id` is how plans point at moves. Usage count already blocks deletion; it retires instead.

**Proposed additions** (no migration written)

| Field | Type | Why |
|---|---|---|
| `section` | warm / main / cool | The generator needs to know where a move can go |
| `pattern` | squat, lunge, hinge, push, pull, core, cardio, mobility | Balanced circuits, and swaps that do the same job |
| `equipment_key` | none, db, band, gym (keep the `equipment` text for display) | Reliable filtering |
| `level` | 1–3 | Difficulty match |
| `work_sec`, `rest_sec` | int | Default intervals (sets and reps stay for plans) |
| `avoid_tags` | text[] (knee, shoulder, back…) | Restriction filtering |
| `builder_ok` | bool, default false | **Approved for generated workouts.** Separate from `is_active` (usable in plans) |
| `status` | draft / active / archived | Drafts are invisible to clients. `archived` maps to `is_active=false` |
| `mistake`, `easier_id`, `harder_id` | text, fk | Instruction and swaps |
| `clip_path`, `clip_poster`, `loop_start_ms`, `loop_end_ms`, `clip_status` | | Playback (see §7) |

**Client restrictions (new):** `client_restrictions(client_id, tag, note, set_by, set_at)`. Only staff can write it. Clients see it read-only.

**Saved and generated workouts (new):** `client_workouts(id, client_id, source: built|featured|saved, spec jsonb, created_at)`.
- `spec` holds warm ids, main { moves, rounds, w, r, rr }, cool ids, and the inputs.
- Plan workouts stay in the existing plans and templates tables. Featured workouts are templates with `is_client_visible` (verify).

**Sessions (new):** `workout_sessions` holds the source ref, a spec snapshot, `started_at`, `ended_at`, `elapsed_sec`, `moves_done`, `moves_total`, `skipped[]`, `rest_added_sec`, `effort`, `note`, and `ended_early`.
- `activity_logs` is for manual activity (verify whether a log table already exists).
- One row per real event. An imported source would carry `external_id` so it is never double-counted.

## 5. Workout engine (deterministic, first release)

**Inputs:** minutes (10, 20, 30 or 45), focus, equipment set, level, today's sore areas, and the coach restrictions.

**1. Pool.** A move qualifies only if all of these hold:
- `builder_ok` and active
- its equipment is in the set, or is none
- its level is at or below the chosen level
- none of its `avoid_tags` match the coach restrictions or today's sore areas

**2. Time split.**
- Warm-up: 2 min if 10 min, otherwise 3.
- Cooldown: 1 min if 10, 3 if 20 or 30, 4 if 45.
- Warm-up and cooldown are 30-second moves with no rest.
- Main = total − warm − cool.

**3. Intervals.**
- Beginner: 30s work / 30s rest. Regular: 40 / 20. Advanced: 45 / 15.
- Mobility and Recovery: 45 / 15, using mobility moves only.

**4. Circuit size and rounds.**
- Try M = the length of the focus pattern list, then −1, then +1 (minimum 3).
- rounds = ⌊(main + r) ÷ (M × (w + r))⌋.
- No rest after the final move.
- Leftover time becomes extra between-round rest: per gap ≤ 90s, in 5-second steps.
- Pick the M that leaves the least unused time without going over.

**5. Patterns by focus**

| Focus | Patterns |
|---|---|
| Full body | squat, push, hinge, pull, core |
| Strength | squat, push, hinge, pull |
| Cardio | cardio, squat, cardio, core |
| Core | core, hinge, core, pull |

- Fallbacks when a pattern is empty: squat↔lunge; others → core; core → hinge.

**6. Picking a move**
- Exclude moves already in the workout.
- Order: not done in the last built workout first, then higher level (closest to the target), then id.
- Take index seed mod n. "Make another" increments the seed.

**7. Not enough moves.** Fewer than 3 main moves, fewer than 2 warm-up moves, or no cooldown: stop.
- Say which inputs caused it.
- Offer "Try 10 minutes" or "Try Full body".
- **Never invent a move.**

**8. Swap.** Same pattern, same pool rules, not already used. At most 3 choices. Plan workouts can't be swapped.

**9. Safety.**
- Coach restrictions always apply and can't be turned off by the client.
- Today's sore areas only remove moves.
- Copy never reassures or diagnoses. "Sharp or new pain? Skip today and tell Gabe."
- End is reachable on every player screen.

**Worked example: 20 min, Full body, no equipment, Beginner, knee restricted**
- Warm-up: 6 × 30s = 3:00. Cooldown: 6 × 30s = 3:00. Main = 14:00.
- M = 5: 2 rounds = 9:30, leaving 4:30 unused (the 90s cap). M = 4: 3 rounds × 4 × 60s − 30s = 11:30, plus 2 × 75s = 14:00, nothing unused. **Choose M = 4.**
- Picks: squat → Box squat to bench (jump squat removed for the knee), push → Incline push-up, hinge → Glute bridge, pull → Prone Y raise.
- Total **20:00**. The review screen shows each line of this math.

**Worked example: 10 min Core, Regular**
- 2:00 warm-up + 1:00 cooldown. Main is 7:00 at 40/20.
- M = 4 gives 1 round (3:40) and M = 3 gives 2 rounds (5:40), leaving 1:20 or 2:20 unused. Rounds cap at 7:00 in this case.
- The engine picks the closest under the target. The review shows the real total (about 6:40 to 8:40). It never pads with invented work.

## 6. Guided player

**Phases.** get ready (5s) → warm-up moves → main rounds → cooldown moves.
- Main rounds go work, rest, work…, then between-rounds rest (r + rr).
- **Timeline = the phase list.** Keep the current index and the ms elapsed in that phase.

**Timing**
- Advance by wall-clock delta (`Date.now()`), not by animation frame.
- If the tab sleeps, the next tick catches up and runs through finished phases. The prototype caps a single delta at 1s.
- Production should compare against a monotonic start time and **auto-pause on `visibilitychange` to hidden**. Resume shows "Paused while you were away."

**Controls**
- Pause and resume freeze or restart the delta.
- Skip a work move: mark it skipped and jump past its rest.
- Previous: after 3 seconds into a move, restart it; otherwise go back one move.
- Restart this move. **+15 seconds** works in rest only and is recorded separately as `rest_added_sec`.
- End opens a confirm sheet, then saves the moves done so far. Unfinished moves are never marked done.

**Audio**
- WebAudio tones: start, 5 seconds left, rest, done. No recorded voice is needed.
- The audio context is created on the Start tap. If the browser still blocks it, a banner says "Sound cues are blocked. Tap to turn them on."
- There is a mute control, plus visual cues (the last 5 seconds turn gold) for people who can't use sound.

**Video**
- The clip loops between `loop_start` and `loop_end`, and the next clip is preloaded during rest.
- If the clip fails or stalls, show "This clip didn't load · Timer keeps going. Follow the cue." The timer never waits on video.

**Saving progress mid-workout**
- The state is saved locally on every phase change and on pause (`ww-client-active` in the prototype).
- Today offers "Pick up where you left off."
- Production should also save the session server-side when it ends, and every few minutes.

**Completion and finishing**
- Completion records the elapsed time, moves done out of the total, skipped moves, rest added, effort, note, and whether it ended early.
- If the save fails, the result stays on screen with a retry.
- **Plan workouts** update the plan's done or part-done state for that day. They never edit the plan.

**Accessibility**
- Countdown is 104px on phone and 150px on web, in tabular numerals. Controls are 56–80px.
- Reduce motion turns off the loop bar animation and transitions.
- Screen reader announces each phase change.

## 7. Video infrastructure

| Option | First release? | Notes |
|---|---|---|
| Supabase Storage (`media_url` today) + signed URLs | **Yes** | Upload MP4/MOV clips of 6–10s. Store the clip, a poster frame, and loop points. Fine for low volume |
| Transcode to H.264 MP4 plus a poster | Yes, minimal | One server function (ffmpeg) or a hosted transcoder. Strip the audio. Cap at 1080p |
| Specialized host (Mux, Cloudflare Stream) | Later, if volume or bandwidth grows | Adaptive streaming, thumbnails, analytics |
| Client-side looping of short clips | **Yes** | A `<video loop muted playsinline>` per move, preloading the next one. No rendered workout files |
| Server-side rendering of a full workout MP4 | Not needed | Only for downloadable or offline exports someday |

## 8. Casting

| Path | What works | Effort |
|---|---|---|
| **Screen mirroring** (AirPlay mirror, Android cast screen) | Shows the phone UI as is. Landscape player layout helps | Nothing to build. Document it first |
| **AirPlay video** (Safari `webkitShowPlaybackTargetPicker`) | Sends a `<video>` element, not our countdown UI | The TV would only show the clip. Needs testing |
| **Google Cast** with a **custom web receiver** | The TV draws our player layout; the phone sends play, pause, skip and extend | A receiver app, Cast SDK, registration, Chrome/Android and TV testing |
| **Dedicated TV app** (tvOS, Android TV) | Best experience | Separate product. Later |

The prototype simulates the custom-receiver experience. It shows the remote on the phone, the TV layout, and losing the connection, which pauses the workout with options to keep going on the phone or reconnect. **None of this is real casting.**

**Rules for casting:**
- The session lives on the phone; the TV only renders.
- Workout progress is never lost when the TV drops.
- Casting is never required to work out.

## 9. Permissions

- **Client** reads:
  - own plans, workouts and sessions
  - `builder_ok` active moves
  - published content for their audience
  - their own restrictions, read-only
- **Client** writes: sessions, activity logs, saved workouts, prefs, check-ins, messages.
- **Owner and coach** read a client's sessions and logs only for their own clients (org RLS). They write moves, restrictions, content and plans.
- **Advisor (Remi): no access** to client sessions, activity, restrictions or check-ins. They are fitness records.
- A self-built workout is labeled "My workout · not reviewed by Gabe" everywhere, including Gabe's view.

## 10. Backend operations

- `generateWorkout(inputs, seed)`: runs on the server so the rules can be audited, and returns the spec. `swapOptions(spec, index)`.
- `startSession` / `completeSession`, `logActivity`, `saveWorkout`.
- `publishContent`, `archiveContent` (extend the Library). `featureWorkout(template_id)` replaces the currently live workout of the week.
- `uploadClip`, then `transcode`, then set `clip_status=ready`. `setLoop`, `setBuilderOk`, which is refused without a clip, a name and a cue.
- `clientActivitySummary(client_id, 7d)` returns plan status, sessions, logs, and flags (effort ≥ 4, ended early, notes that mention pain or tightness).

## 11. Performance

- Preload only the current and next clip. Poster first.
- Keep each clip under about 3 MB at 720p.
- Phase ticks run every 200ms with no network calls. Session writes happen only at the end, plus a checkpoint every 5 minutes.

## 12. Testing

- **Engine unit tests:** every focus, time and level combination stays at or under the target. No restricted, archived, draft or not-approved move appears. Insufficient-move cases return the failure. The same seed always gives the same workout.
- **Player:** pause and resume keep the remaining time to within 200ms. Skip, previous and extend work. Backgrounding behaves as designed. Ending early records only the done moves.
- **Audio:** cues play after Start on iOS Safari and Android Chrome. The blocked-sound banner shows when it should.
- **Video:** a failed or slow clip never stalls the timer.
- **Casting:** device matrix (Chromecast, Google TV, Apple TV, mirroring). Losing the connection never loses progress.
- **RLS:** a client reads only their own rows. The advisor reads zero fitness rows.
- **Archiving:** past sessions and plans still show the move's name.

## 13. Phases

1. **Today and Progress.** Weekly content from the Library, plan visibility, Add an activity, history.
2. **Exercise Studio.** New fields, drafts, `builder_ok`, clips and loop points, the client preview.
3. **Build a workout.** The engine, swap, save, restrictions.
4. **Guided player.** Loops, timers, cues, pause, resume, skip, extend, completion. Plan workouts move to the player.
5. **TV and more.** Mirroring docs, then the Cast receiver, richer preferences, optional AI suggestions behind Gabe's rules.

## 14. Usability review

**Fixed in the prototype**
- Builder steps were one screen per question. Now it's one screen, with difficulty remembered.
- The swap list was the full library. Now it's at most 3 choices.
- The rule for which content leads Today was unclear. Now the newest live item leads and at most two others sit under it.
- Plan workouts could be edited by the client. Now they're locked, with "message Gabe."

**Open**
- Whether homework is its own model. (Verify.)
- How Gabe's Movements manager looks today, compared with the Studio. (Read `ExerciseComposer` and `MovementsList` before building.)
- Whether `kind` already distinguishes warm-up from main from cooldown.
- Whether a Library audience field exists.

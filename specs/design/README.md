# Handoff: Wild Wanderers, Production Redesign v2

## Overview
This is one connected redesign of app.wildwanderers.life (repo `remi-sobo/wildwanderers-app`) for three roles:

- **Gabe (owner), phone and web.**
  - Today, Week, Business, and Messages.
  - Redesigned operational screens: Tasks, Schedule, Clients, Dads & Kids, Leads, Numbers, Pop-up roll call, and Settings.
  - **Exercise Studio** and one composer for publishing to clients.
- **Remi (business advisor, a new role).** Overview, Calls (transcript to action), and Work.
- **Client, phone and web.**
  - Today, Workouts, Progress, and Me.
  - Build a workout, using a rules-based generator.
  - A guided player with timed clips.
  - A simulated TV and remote flow.

There is one shared set of example data across all modes. A task, workout, or post created in one role shows up in the others.

## About the design files
The files in `prototype/` are **design references built in HTML**. They show the intended look and behavior. They are not production code to copy.

**The task:** rebuild these designs inside the existing Next.js, Supabase, Tailwind, and lucide-react app, using its components, routes, RLS, and data layer.

- Do not ship the HTML.
- Do not create parallel data stores. There is one task table, one calendar, and one exercise library, all extended rather than duplicated.

To view the prototype, open `prototype/Wild Wanderers - Production Redesign v2.dc.html` from a local static server.

**Prototype only (do not build):**
- the dark bar along the top, with the mode switcher, Weak signal, Flows, and Reset
- the "example state" chips
- the player speed control
- the "drop the connection" button
- the simulated clip upload
- the TV panel

## Fidelity
**High fidelity.**
- Colors, type, spacing, radii, copy, and interactions are final.
- Match them, using the existing tokens (`tokens/colors.css`, `typography.css`, `spacing.css`, which are copied verbatim from the repo) and the app's existing components.
- The copy is the final copy.
- All names and numbers are examples. Never ship them.

## Detailed specs (read these next)
- **`FINAL_IMPLEMENTATION_HANDOFF.md`** covers Gabe HQ, Business, and Remi:
  - navigation map, screen inventory, feature-preservation map
  - task and schedule rules, advisor permissions and RLS
  - transcript to action
  - states, rollout order, regression checklist
- **`CUSTOMER_FITNESS_IMPLEMENTATION_HANDOFF.md`** covers the client app and Gabe's fitness tools:
  - exercise data additions
  - workout engine rules with worked examples
  - guided player spec, video and casting options
  - permissions, testing, phases

Both list what was **not verified** against the repo. Read those components before building.

## Screens
Every screen is described in the two spec files above, with its purpose, phone and web behavior, actions, and dependencies. Where each lives in the prototype:

| Area | File | Notes |
|---|---|---|
| Mode shell, sign in | `Wild Wanderers - Production Redesign v2.dc.html` | Sign in: split photo and form. Role decides where you land |
| Gabe Today, Week, Plan my week, Goals, Capture | `GabeApp.dc.html` | `layout="phone"` (390×844 frame, bottom tabs) or `"desktop"` (240px left rail) |
| Gabe Business home and all operational modules | `GabeOps.dc.html` | Mounted by GabeApp for the Business and Messages tabs |
| Exercise Studio, Publish | `GabeFitness.dc.html` | `mode="studio"` or `"publish"`. Mounted by GabeOps for `studio` and `library` |
| Remi Overview, Calls, Work | `RemiApp.dc.html` | 240px left rail on desktop |
| Client Today, Workouts, Build, Review, Player, Finish, Progress, Me | `ClientApp.dc.html` | `layout="phone"` (frame, bottom tabs) or `"desktop"` (240px left rail) |
| Example data | `ww-shared.js` | One record per task, block, lead, client, move, workout, content item, and log entry. See its `seed()` and `seedFit()` for the shape |

### Shared layout rules
- **The left rail is identical for all three roles on desktop.**
  - 240px wide, background `#1E331F` (forest-deep).
  - Logo lockup: `mark-bone.png` at 30px, plus "Wild Wanderers" in Fraunces 17px.
  - One amber primary button: Capture (Gabe), Prep the call (Remi), Build a workout (Client).
  - Nav items in Fraunces 15px with Lucide icons at 18px.
    - Active item: `rgba(246,241,231,.1)` background, bone text.
    - Inactive item: `rgba(246,241,231,.75)` text.
  - Person footer: 30px amber avatar, name in 12.5px/600, role in 11px.
- **Phone:**
  - Bottom tab bar is 82–84px tall on `#1E331F`.
  - Active tab is amber `#D98A3A`, inactive is `rgba(246,241,231,.65)`, labels are 11.5px/600.
  - Content padding is 52px 16px 110px.
  - Sheets slide up from the bottom: 24px top radius, max height 88–90%.
  - Touch targets are at least 44px.
- **Desktop:**
  - Content is max 1120px wide with 28px padding.
  - Sheets become right-side drawers 440–460px wide.
  - Grids use `repeat(auto-fit,minmax(min(100%,300–320px),1fr))`, so they collapse to one column when narrow.
- **Cards:**
  - Paper `#FDFBF5`, hairline border `rgba(42,33,24,.12)`, 16–22px radius.
  - Shadow: `0 1px 2px rgba(42,33,24,.05), 0 8px 24px rgba(42,33,24,.06)`.
  - Dark feature cards are `#1E331F` with cream `#F2C879` eyebrows.
- **Eyebrows:** Plus Jakarta 11px/600, letter-spacing .2em, uppercase, bark `#7A7264`.
- **Titles:** Fraunces 400–500 at 27–32px for page titles and 19–25px for card titles, with one italic accent word in bark.
- **Numbers:** Fraunces 26–40px. In the player the countdown is 92px on phone, 80px in landscape, and 150px on desktop, using tabular numerals.
- **Buttons:**
  - Primary: amber `#D98A3A` fill, ink `#23170c` text, fully rounded, 44–56px tall, 14–16px/600–700.
  - Secondary: 1.5px forest outline.
  - Only one primary button per view.
- **Chips:**
  - Fully rounded, 36–50px tall.
  - Selected: forest `#2E4A33` fill with bone text.
  - Unselected: `rgba(42,33,24,.20)` border.
- **States:**
  - Caution: ochre text `#8A6A1F` or `#7A5A12` on `rgba(192,148,46,.1)`.
  - Positive: fern.
  - Never use red on anything about a person's body or progress.

## Interactions and behavior (summary)
The full detail is in the spec files.

- **One task identity.** Checking a task in Today, Week, Tasks, a lead, a client, or a pop-up day marks it done everywhere. Remi's assignments land in Gabe's real tasks.
- **Failed saves.** When the save fails (shown with "Weak signal" in the prototype), the row stays unchanged, shows "Not saved · Retry", and a toast appears. Forms and messages keep the user's input.
- **Schedule.**
  - Work blocks are dashed amber and movable.
  - Fixed sessions are solid and never moved automatically.
  - Moving a block into a conflict is refused, naming the session it hits.
  - Busy holds reduce available work time.
- **Workout generator.** Deterministic, using only approved moves, with coach restrictions always applied. When there aren't enough moves it says so and offers alternatives. It never invents a move.
- **Player.**
  - Timing is wall-clock based, ticking every 200ms. Phases run get ready (5s), then warm-up, then rounds of work and rest, then cooldown.
  - Controls: pause, skip, previous, restart, and +15s rest (recorded separately).
  - Ending early saves only completed moves.
  - Cues use WebAudio tones, unlocked on Start, with a banner if the browser blocks them. A visual cue turns the countdown gold for the last 5s.
  - If a clip fails, the timer keeps running.
- **TV.** In the prototype this is simulated: the phone becomes the remote, and losing the connection pauses the workout with "Keep going on this phone" or "Reconnect".
- **Motion.** Calm and short: 150–250ms fade-and-rise, all gated by `prefers-reduced-motion`. Focus ring is a 2px amber outline at offset 3.

## State management
These are the entities and their relationships. Production should use Supabase tables with RLS, as listed in the spec files.

- **Gabe**
  - `business_tasks`, plus new columns: `assigned_by`, `kind`, `source_session_item_id`, `goal_id`.
  - New tables: `day_focus`, `week_plans`.
  - Existing: `schedule_blocks` with `schedule_block_tasks`, plus a new `hold` block kind.
- **Remi:** `advisor_relationships`, `advisor_shares`, `advisor_items`, `coaching_sessions`, `session_items`.
- **Fitness**
  - `exercise_library` gains `section`, `pattern`, `equipment_key`, `level`, `work_sec`, `rest_sec`, `avoid_tags`, `builder_ok`, `status`, and clip fields.
  - New tables: `client_restrictions`, `client_workouts`, `workout_sessions`, and `activity_logs` (check first whether one already exists).
- **Library:** extend it to cover post, tip, and workout-of-the-week types, plus `audience` and `publish_at`. Only one workout of the week can be live at a time.

## Design tokens
These are in `prototype/_ds/.../tokens/`, ported verbatim from the repo.

| Token | Value |
|---|---|
| Bone canvas | `#F6F1E7` |
| Paper card | `#FDFBF5` |
| Inset | `#EDE4D3` |
| Ink | `#2A2118` |
| Forest | `#2E4A33` |
| Forest-deep (chrome) | `#1E331F` |
| Amber, the only action color | `#D98A3A` |
| Amber-deep | `#BF6F1C` |
| Cream, accent on dark only | `#F2C879` |
| Ochre caution | `#C0942E` |
| Brick error | `#B4472E` |
| Bark neutrals | `#4A4234`, `#7A7264`, `#9C9482` |

- **Fonts:** Fraunces (display, numerals) and Plus Jakarta Sans (UI). The woff2 files are in the design system.
- **Spacing:** 8px grid. Card padding 14–24px, section gaps 14–24px.
- **Radii:** cards 16–22px, inputs 10–12px, pills and buttons 999px.

## Assets
- `assets/mark-bone.png` and `mark-forest.png` are the logo mark from the brand system. Never recolor them.
- `assets/login-scene.webp` is the sign-in photo.
- Icons are Lucide (`lucide-react` in the app; the prototype uses the UMD build at 0.460.0, stroke 1.75, or 2 when active).
- **Every exercise clip and video in the prototype is a labeled placeholder.** Real footage comes from Gabe through Exercise Studio uploads. Never generate a likeness of him.

## Files
```
design_handoff_wild_wanderers_v2/
  README.md                                   ← this file
  FINAL_IMPLEMENTATION_HANDOFF.md             ← Gabe HQ, Business, Remi spec
  CUSTOMER_FITNESS_IMPLEMENTATION_HANDOFF.md  ← Client + fitness spec
  prototype/
    Wild Wanderers - Production Redesign v2.dc.html   ← open this
    GabeApp.dc.html  GabeOps.dc.html  GabeFitness.dc.html
    RemiApp.dc.html  ClientApp.dc.html
    ww-shared.js     ← example data + shared store (prototype only)
    support.js       ← prototype runtime (not for production)
    assets/  _ds/    ← brand assets and tokens
```

## Build order
This is in short; each spec file has the detail.

1. Add an `owner_hq` flag, so turning it off restores today's owner app exactly.
2. Advisor role and RLS.
3. Remi Work and assignments.
4. Gabe Today and the new tabs.
5. Calls.
6. Week.
7. Business home and Tasks, then Schedule.
8. Regroup Clients, Dads & Kids, and Leads.
9. Numbers.
10. Client Today and Progress.
11. Exercise Studio.
12. Build a workout.
13. Guided player.
14. TV.

Coach, client, and parent experiences outside these screens stay unchanged.
